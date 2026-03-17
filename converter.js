// converter.js using pdf.js and docx.js
import { supabase } from './supabaseClient.js';

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const defaultContent = document.querySelector('.default-content');
const selectedFileName = document.getElementById('selectedFileName');
const changeFileBtn = document.getElementById('changeFileBtn');
const convertBtn = document.getElementById('convertBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');

let currentFile = null;

// UI Sync with Auth State
async function syncUI() {
    const { data: { session } } = await supabase.auth.getSession();
    const dynamicElements = [
        document.querySelector('.zest-brand'),
        ...document.querySelectorAll('.text-orange')
    ];
    if (session) {
        dynamicElements.forEach(el => el && el.classList.add('logged-in'));
    }
}
syncUI();

// Event Listeners for Drop Zone
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('active');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

changeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('PDF 파일만 선택 가능합니다.');
        return;
    }
    currentFile = file;
    selectedFileName.textContent = file.name;
    defaultContent.style.display = 'none';
    fileInfo.style.display = 'flex';
    convertBtn.style.display = 'block';
    resetProgress();
}

function resetProgress() {
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
    statusText.textContent = '';
}

convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    convertBtn.disabled = true;
    convertBtn.textContent = '변환 중...';
    progressContainer.style.display = 'block';
    statusText.textContent = 'PDF 데이터를 불러오는 중...';

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        
        // Ensure libraries are available
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF 라이브러리를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        }

        const docxLib = window.docx || (typeof docx !== 'undefined' ? docx : null);
        if (!docxLib) throw new Error('Word 라이브러리를 찾을 수 없습니다.');
        const { Document, Packer, Paragraph, TextRun } = docxLib.Document ? docxLib : (docxLib.default || docxLib);

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        
        const docSections = [];

        for (let i = 1; i <= totalPages; i++) {
            statusText.textContent = `페이지 분석 중 (${i} / ${totalPages})...`;
            const percent = (i / totalPages) * 50; 
            progressBar.style.width = `${percent}%`;

            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Group text items by Y coordinate (lines)
            const lines = [];
            textContent.items.forEach(item => {
                // transform[5] is the Y-coordinate (bottom-up in PDF)
                const y = Math.round(item.transform[5]);
                const fontSize = Math.abs(item.transform[0]); 
                
                let line = lines.find(l => Math.abs(l.y - y) < 5); // 5 unit threshold for same line
                if (!line) {
                    line = { y: y, items: [] };
                    lines.push(line);
                }
                line.items.push({
                    text: item.str,
                    x: item.transform[4],
                    fontSize: fontSize
                });
            });

            // Sort lines from top to bottom (Y is bottom-up)
            lines.sort((a, b) => b.y - a.y);

            const pageParagraphs = lines.map(line => {
                // Sort items in line by X coordinate
                line.items.sort((a, b) => a.x - b.x);
                
                return new Paragraph({
                    children: line.items.map(it => new TextRun({
                        text: it.text + " ",
                        size: Math.round(it.fontSize * 2), // DOCX size is in half-points
                        font: "Pretendard"
                    })),
                    spacing: { before: 100, after: 100 }
                });
            });

            docSections.push({
                children: pageParagraphs
            });
        }

        statusText.textContent = '워드 파일 생성 중...';
        progressBar.style.width = `80%`;

        const doc = new Document({
            sections: docSections
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, currentFile.name.replace('.pdf', '') + "_layout_preserved.docx");

        progressBar.style.width = `100%`;
        statusText.textContent = '변환 완료!';
        convertBtn.textContent = '변환 완료! (다시 하려면 클릭)';
        convertBtn.disabled = false;

    } catch (error) {
        console.error("Conversion Detail Error:", error);
        statusText.textContent = `변환 중 오류: ${error.message || '알 수 없는 오류'}`;
        convertBtn.disabled = false;
        convertBtn.textContent = '워드 파일로 변환하기 🚀';
    }
});
