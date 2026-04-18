import fs from 'fs';

async function run() {
    const fd = new FormData();
    fd.append('id', 'upload-1234');
    fd.append('metadata', JSON.stringify({
        title: 'Untitled',
        category: 'My Uploads',
        difficulty: 'normal',
        isUserUpload: true,
        isAi: false
    }));
    
    // Pass blobs as files
    const emptyBlob = new Blob([''], {type: 'image/jpeg'});
    fd.append('fullImage', emptyBlob, 'full.jpg');
    fd.append('thumbImage', emptyBlob, 'thumb.jpg');

    const response = await fetch('http://localhost:3000/api/puzzles', {
        method: 'POST',
        body: fd
    });
    
    const text = await response.text();
    console.log(response.status, text);
}
run();
