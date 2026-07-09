// Vercel Serverless Function
const https = require('https');

// 关键词白名单
const KEYWORDS = ['印发','规划','通知','意见','财税','体制改革','国务院','部委','发改委','央行','出台','提升专项'];

// 简单的AI分析模板（根据标题关键词生成）
function generateAnalysis(title) {
    const intentMap = {
        '印发':'通过发布正式文件推动政策落地，意图建立长效机制。',
        '通知':'通过行政命令快速部署工作任务，确保下级执行。',
        '意见':'为特定领域改革提供指导性方向，释放改革信号。',
        '财税':'调整央地财政关系或税收工具，意在优化经济结构。',
        '体制改革':'从制度层面打破现有瓶颈，激发市场活力。',
        '国务院':'最高行政机关直接部署，凸显政策优先级。',
        '发改委':'聚焦宏观经济与产业规划，调控资源配置。',
        '央行':'运用货币政策工具调节流动性，稳定金融市场。',
        '出台':'新政策正式亮相，填补监管或支持空白。',
        '规划':'制定中长期发展蓝图，引导社会预期。',
        '提升专项':'针对特定领域加大投入，力求突破短板。'
    };
    let intent = '围绕关键词出台相关政策，旨在解决对应领域突出问题。';
    for (let [kw, desc] of Object.entries(intentMap)) {
        if (title.includes(kw)) { intent = desc; break; }
    }
    return {
        intent: intent,
        problem: '当前该领域存在制度不完善、执行不到位或市场失灵等问题，需要政策干预。',
        effect: '政策短期有望提振信心、引导资源倾斜，长期效果取决于执行力度和配套措施。'
    };
}

// 判断新闻是否匹配关键词
function matchesPolicy(text) {
    return KEYWORDS.some(kw => text.includes(kw));
}

// 获取并解析RSS
function fetchRSS() {
    return new Promise((resolve, reject) => {
        const url = 'https://rsshub.app/cls/telegraph';
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    // 简单解析RSS XML（不依赖第三方库，用正则提取item）
                    const items = [];
                    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
                    let match;
                    while ((match = itemRegex.exec(data)) !== null) {
                        const itemXml = match[1];
                        const title = (itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || [,''])[1];
                        const description = (itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || [,''])[1];
                        const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [,''])[1];
                        if (title && description) {
                            items.push({ title, description, pubDate });
                        }
                    }
                    resolve(items);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

module.exports = async (req, res) => {
    try {
        const items = await fetchRSS();
        // 过滤政策相关新闻
        const filtered = items.filter(item => matchesPolicy(item.title + item.description));
        // 构建返回数据
        const news = filtered.map((item, index) => ({
            id: `cls-${index}-${Date.now()}`,
            title: item.title,
            content: item.description.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
            timestamp: item.pubDate || new Date().toLocaleString(),
            matched_keywords: KEYWORDS.filter(kw => item.title.includes(kw) || item.description.includes(kw)),
            ai: generateAnalysis(item.title)
        }));
        res.status(200).json({ news });
    } catch (err) {
        res.status(500).json({ error: '获取数据失败', message: err.message });
    }
};
