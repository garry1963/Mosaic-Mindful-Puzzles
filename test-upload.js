import fs from 'fs';

async function run() {
    const fd = new FormData();
    fd.append('id', 'test-upload-123');
    fd.append('metadata', JSON.stringify({ title: 'Test from script' }));
    
    // Create a dummy file
    fs.writeFileSync('dummy.jpg', 'fake image content');
    const blob = new Blob([fs.readFileSync('dummy.jpg')], { type: 'image/jpeg' });
    fd.append('fullImage', blob, 'full.jpg');
    fd.append('thumbImage', blob, 'thumb.jpg');

    try {
        const res = await fetch('http://localhost:3000/api/puzzles', {
            method: 'POST',
            body: fd
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
run();
