require('dotenv').config();
const { chromium } = require('playwright');
const { Client } = require('@notionhq/client');

// Create connection to Notion
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

async function syncUITToNotion() {
    console.log('Khởi động bot...');
    
    // Open the browser
    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 1. Goto login page
        console.log('Đang truy cập cổng đăng nhập...');
        await page.goto('https://courses.uit.edu.vn/login/index.php'); 

        // 2. Fill account
        await page.fill('#username', process.env.UIT_USERNAME);
        await page.fill('#password', process.env.UIT_PASSWORD);

        console.log('Đang bấm đăng nhập...');
        await page.click('#loginbtn');

        // 3. Waiting moodle
        console.log('Đang đợi hệ thống cấp quyền (5 giây)...');
        await page.waitForTimeout(5000); 

        // 4. Direct to calendar page
        console.log('Chuyển hướng đến trang Lịch...');
        await page.goto('https://courses.uit.edu.vn/calendar/view.php?view=month', { waitUntil: 'domcontentloaded' });

        // 5. Crawl deadlines
        console.log('Đang quét lịch và thu thập thông tin môn học chi tiết (có thể mất vài giây)...');
        
        const monthlyDeadlines = [];
        
        // TSelect days with events
        const daysWithEvents = await page.$$('td.hasevent');

        for (const day of daysWithEvents) {
            const timestampStr = await day.getAttribute('data-day-timestamp');
            if (!timestampStr) continue;
            
            const timestamp = parseInt(timestampStr) * 1000;
            const dateIso = new Date(timestamp).toISOString();

            const eventItems = await day.$$('li[data-region="event-item"]');

            for (const item of eventItems) {
                const eventType = await item.getAttribute('data-event-eventtype');
                
                if (eventType === 'due' || eventType === 'close') {
                    const linkTag = await item.$('a[data-action="view-event"]');
                    if (!linkTag) continue;

                    let rawTitle = await item.$eval('.eventname', el => el.innerText);
                    
                    // Delete quiz
                    if (rawTitle.toLowerCase().includes('quiz')) {
                        continue; 
                    }

                    let taskTitle = rawTitle.replace('tới hạn', '').replace('kết thúc', '').trim();
                    let courseClass = "Khác";
                    const url = await linkTag.getAttribute('href');

                    // Open deadline to crawl class
                    console.log(`Đang quét bài: ${taskTitle}...`);
                    await linkTag.click(); 
                    
                    try {
                        await page.waitForSelector('.summary-modal-container', { state: 'visible', timeout: 3000 });
                        
                        courseClass = await page.evaluate(() => {
                            const icon = document.querySelector('.summary-modal-container .fa-graduation-cap');
                            if (icon) {
                                const row = icon.closest('.row');
                                if (row) {
                                    const classDiv = row.querySelector('.col-11');
                                    if (classDiv) {
                                        let fullText = classDiv.innerText.trim();
                                        if (fullText.includes('-')) {
                                            return fullText.split('-').pop().trim();
                                        }
                                        return fullText;
                                    }
                                }
                            }
                            return "Khác";
                        });

                        await page.keyboard.press('Escape');
                        await page.waitForSelector('.summary-modal-container', { state: 'hidden', timeout: 3000 });
                        
                    } catch (error) {
                        console.log(`Không thể lấy mã môn học (Bỏ qua), bài: ${taskTitle}`);
                        await page.keyboard.press('Escape'); 
                    }

                    // Clean the title
                    if (taskTitle.includes('|')) {
                        const parts = taskTitle.split('|');
                        taskTitle = parts.slice(1).join(' | ').trim();
                    }

                    monthlyDeadlines.push({
                        title: taskTitle,
                        class: courseClass, 
                        url: url,
                        date: dateIso
                    });
                }
            }
        }

        console.log(`Quét thành công ${monthlyDeadlines.length} bài tập cần nộp!`);
        console.table(monthlyDeadlines);
        // 6. Push to notion
        console.log('Đang đẩy dữ liệu lên Notion...');
        await pushToNotion(monthlyDeadlines);
        
        console.log('Hoàn tất quy trình!');

    } catch (error) {
        console.error('Đã xảy ra lỗi trong quá trình chạy:', error);
    } finally {
        await browser.close();
    }
}

async function pushToNotion(deadlines) {
    let dataSourceId;
    try {
        const dbInfo = await notion.databases.retrieve({ database_id: databaseId });
        
        if (!dbInfo.data_sources || dbInfo.data_sources.length === 0) {
             console.error('Không tìm thấy Data Source nào trong Database này!');
             return;
        }
        dataSourceId = dbInfo.data_sources[0].id; 
    } catch (err) {
        console.error('Lỗi đọc Database. Hãy chắc chắn bạn đã Add connection bot vào trang Notion!');
        return;
    }

    console.log(`Đã kết nối thành công với Notion! Bắt đầu đồng bộ...`);

    for (const task of deadlines) {
        try {
            const existingPages = await notion.dataSources.query({
                data_source_id: dataSourceId,
                filter: {
                    property: 'Link', 
                    url: {
                        equals: task.url
                    }
                }
            });

            if (existingPages.results.length > 0) {
                // Existed -> Update deadlines
                const pageId = existingPages.results[0].id;
                await notion.pages.update({
                    page_id: pageId,
                    properties: {
                        'Deadline': { date: { start: task.date } }
                    }
                });
                console.log(`[Cập nhật ngày] 🔄 ${task.class} - ${task.title}`);
            } else {
                // Didn't exists -> Create new
                await notion.pages.create({
                    parent: { data_source_id: dataSourceId },
                    properties: {
                        'Title': { title: [{ text: { content: task.title } }] },   
                        'Class': { rich_text: [{ text: { content: task.class } }] }, 
                        'Deadline': { date: { start: task.date } },                  
                        'Link': { url: task.url }                                   
                    }
                });
                console.log(`[Thêm mới] ${task.class} - ${task.title}`);
            }
        } catch (error) {
            console.error(`Lỗi đồng bộ bài [${task.title}]:`, error.body || error.message);
        }
    }
}

syncUITToNotion();