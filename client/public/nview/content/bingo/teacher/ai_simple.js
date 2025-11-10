console.log('AI Integration Loading...');
const API = 'http://localhost:5000/api/nview';
let ready = false;

async function checkAI() {
    try {
        await fetch(API + '/health');
        ready = true;
        console.log('AI Ready!');
    } catch(e) {
        ready = false;
    }
}

function initAI() {
    const div = document.createElement('div');
    div.id = 'ai-panel';
    div.style.cssText = 'position:fixed;top:20px;right:20px;background:white;padding:20px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:9999;width:300px;';
    div.innerHTML = '<h3>AI Panel</h3><p>Ready!</p>';
    document.body.appendChild(div);
    checkAI();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAI);
} else {
    initAI();
}
