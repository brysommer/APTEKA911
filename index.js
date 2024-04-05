import puppeteer from 'puppeteer';
import { parseXml } from './urlsDb.js';
import xlsx from 'xlsx';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import shopUrls from './linksDb.js'

async function scrapeApteka911() {
    const botToken = '7083999454:AAGse7TlBAyrvQ63sv-uDVZlBlb9Slo7pS8';
    const chatId = -1002026112139;
    const bot = new TelegramBot(botToken, { polling: false });

    async function sendTelegramMessage(message) {
        try {
            await bot.sendMessage(chatId, message);
            console.log('Message sent to Telegram channel:', message);
        } catch (error) {
            console.error('Error sending message to Telegram channel:', error);
        }
    }

    //const urls = await parseXml();
    const urls = shopUrls;

    const browser = await puppeteer.launch();

    // Отправляем сообщение о начале парсинга и указываем количество ссылок
    sendTelegramMessage(`Парсинг начат. Всего ссылок для обработки: ${urls.length}`);

    // Обработка файла count.js
    let count = 0;
    if (fs.existsSync('count.js')) {
        const fileContent = fs.readFileSync('count.js', 'utf8');
        const match = fileContent.match(/let count = (\d+);/);
        if (match) {
            count = parseInt(match[1]);
        }
    }

    const filePath = 'products.xlsx';
    let workbook;

    try {
        workbook = xlsx.readFile(filePath);
    } catch (error) {
        workbook = xlsx.utils.book_new();
    }

    let productsWorksheet = workbook.Sheets['Products'];
    if (!productsWorksheet) {
        productsWorksheet = xlsx.utils.aoa_to_sheet([['Ean', 'Name', 'Price']]);
        xlsx.utils.book_append_sheet(workbook, productsWorksheet, 'Products');
    }

    const addProductToWorksheet = (worksheet, product) => {
        const lastRowIndex = worksheet['!ref'] ? xlsx.utils.decode_range(worksheet['!ref']).e.r : 0;
        const nextRowIndex = lastRowIndex + 1;

        const data = [[product.ean, product.name, product.price]];

        xlsx.utils.sheet_add_aoa(worksheet, data, { origin: { r: nextRowIndex, c: 0 } });
    };

    const addedProducts = new Set();

    for (let i = count; i < urls.length; i++) {
        const url = urls[i];
        const page = await browser.newPage();
        try {
            await page.goto(url, { timeout: 60000 });
        } catch (error) {
            console.error(`Error navigating to ${url}:`, error);
            await sendTelegramMessage(`Ошибка при загрузке страницы ${url}: ${error.message}`);
            await page.close();
            continue;
        }

        await page.waitForSelector('#wrp-content > div.product-head-instr.tl > h1');
        await page.waitForSelector('#main > div.shopping-conteiner > div.b__shopping > div.b-product__shopping.instruction.full > div:nth-child(1) > div > div > div');
        await page.waitForSelector('#wrp-content > div.product-head-instr.tl > span');

        const productData = await page.evaluate(() => {
            const nameElement = document.querySelector('#wrp-content > div.product-head-instr.tl > h1');
            const name = nameElement.textContent.trim();

            const eanElement = document.querySelector('#wrp-content > div.product-head-instr.tl > span');
            let eanText = eanElement.textContent.trim();

            const eanMatch = eanText.match(/(\d+)/);
            const ean = eanMatch ? parseInt(eanMatch[0]) : null;

            const priceElement = document.querySelector('#main > div.shopping-conteiner > div.b__shopping > div.b-product__shopping.instruction.full > div:nth-child(1) > div > div > div');
            let priceText = priceElement.textContent.trim();

            const priceMatch = priceText.match(/(\d+(\.\d+)?)/);
            const price = priceMatch ? parseFloat(priceMatch[0]) : null;

            return { ean, name, price };
        });

        if (!addedProducts.has(productData.name)) {
            addProductToWorksheet(productsWorksheet, productData);
            addedProducts.add(productData.name);
            console.log('Data from', url, 'has been added to products.xlsx');

            if ((i + 1) % 10 === 0 || i === urls.length - 1) {
                const message = `Обработано ${i + 1} из ${urls.length} ссылок.`;
                await sendTelegramMessage(message);
            }
        }

        await page.close();

        xlsx.writeFile(workbook, filePath);

        const randomDelay = Math.floor(Math.random() * (8000 - 2000 + 1)) + 2000;
        console.log(`Waiting for ${randomDelay / 1000} seconds before the next request...`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));

        // Обновляем файл count.js после обработки каждой ссылки
        fs.writeFileSync('count.js', `let count = ${i + 1};\n`);
    }

    sendTelegramMessage('Парсинг завершен.');

    await browser.close();
}

scrapeApteka911();
