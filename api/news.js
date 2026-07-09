// Vercel Serverless Function - 稳定版（带兜底数据）
const https = require('https');

const KEYWORDS = ['印发','规划','通知','意见','财税','体制改革','国务院','部委','发改委','央行','出台','提升专项'];

// 内置示例数据，防止抓取失败时空页面
const FALLBACK_NEWS = [
    {
        id: 'fb-1',
        title: '【示例】工信部印发工业大模型应用通知',
        content: '四部门印发通知，到2027年培育100个以上工业大模型标杆应用...',
        timestamp: new Date().toLocaleString(),
        matched_keywords: ['印发','通知'],
        ai: {
            intent: '推动制造业数智化转型，降低边际成本。',
            problem: '中小企业资金不足，升级意愿低。',
            effect: '财政贴息能激活部分需求，但无法解决下游订单不足。'
        }
    }
];

function generateAnalysis(title) {
    let intent = '围绕政策关键词出台相关措施，旨在解决行业突出问题。';
    if (title.includes('印发')) intent = '通过发布正式文件推动政策落地，建立长效机制。';
    else if (title.includes('通知')) intent = '以行政命令快速部署工作任务，确保执行力。';
    else if (title.includes('意见')) intent = '为改革提供指导方向，释放政策信号。';
    else if (title.includes('财税')) intent = '调整央地财政关系或税收工具，优化经济结构。';
    else if (title.includes('国务院')) intent = '最高行政机关直接部署，凸显政策优先级。';
    else if (title.includes('央行')) intent = '运用货币政策工具调节流动性，稳定市场预期。';
    return {
        intent,
        problem: '当前该领域存在制度壁垒或市场失灵，亟需政策干预。',
        effect: '短期有望提振信心、引导资源，长期取决于执行力度。'
    };
}

function matchesPolicy(text) {
    return KEYWORDS.some(kw => text.includes(kw));
}

function fetchWithTimeout(url, timeout = 8000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
    });
}

async function getNews() {
    try {
        const xml = await fetchWithTimeout('https://rsshub.app/cls/telegraph');
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
            const block = match[1];
            const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || [,''])[1];
            const desc = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || [,''])[1];
            const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [,''])[1];
            if (title && desc) items.push({ title, description: desc.replace(/<[^>]*>/g,''), pubDate });
        }
        const filtered = items.filter(item => matchesPolicy(item.title + item.description));
        if (filtered.length === 0) throw new Error('无匹配政策快讯');
        return filtered.map((item, i) => ({
            id: `cls-${i}`,
            title: item.title,
            content: item.description.substring(0, 200) + '...',
            timestamp: item.pubDate || new Date().toLocaleString(),
            matched_keywords: KEYWORDS.filter(kw => item.title.includes(kw)),
            ai: generateAnalysis(item.title)
        }));
    } catch (e) {
        console.error('抓取失败，使用兜底数据:', e.message);
        return FALLBACK_NEWS;
    }
}

module.exports = async (req, res) => {
    const news = await getNews();
    res.status(200).json({ news });
};
