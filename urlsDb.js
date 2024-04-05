import { parseString } from 'xml2js';
import { readFile } from 'fs/promises'; 
import fs from 'fs';
//import { shopUrls } from './linksDb.js'

const readXmlFile = async () => {
    try {
        const file = await readFile('./sitemap.xml', 'utf8');
        return file;
    } catch (error) {
        console.error('Error reading file:', error);
        throw error;
    }
};

export const parseXml = async () => {
    try {
        if (shopUrls) return shopUrls;
        const xmlData = await readXmlFile();
        const result = await new Promise((resolve, reject) => {
            parseString(xmlData, (err, res) => {
                if (err) reject(err);
                resolve(res);
            });
        });
        let urls = result.urlset.url.map(url => url.loc[0]);
        const shopUrls = {};
        urls.forEach(url => {
            const shopIndex = url.indexOf('/shop/');
            if (shopIndex !== -1) {
                const shopUrl = url.substring(shopIndex + 6); // +6 to skip '/shop/'
                shopUrls[shopUrl] = url;
            }
        });

        const valuesArray = Object.values(shopUrls);

        // Перетворюємо кожен елемент масиву на рядок, розділений переносом
        const valuesString = valuesArray.map(value => JSON.stringify(value)).join(',\n');

        // Генеруємо рядок JavaScript, що містить значення масиву з рядками, розділеними переносом
        const jsCode = `const shopUrls = [\n${valuesString}\n];\n\nexport default shopUrls;`;

        // Записуємо рядок JavaScript у файл
        fs.writeFile('linksDb.js', jsCode, (err) => {
        if (err) {
            console.error('Помилка під час запису у файл:', err);
            return;
        }
        console.log('Дані успішно записано у файл ');
        });

        return Object.values(shopUrls);
    } catch (error) {
        console.error('Error parsing XML:', error);
        throw error;
    }
};

