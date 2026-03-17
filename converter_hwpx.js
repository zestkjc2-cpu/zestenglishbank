// converter_hwpx.js
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

async function syncUI() {
    const { data: { session } } = await supabase.auth.getSession();
    const dynamicElements = [document.querySelector('.zest-brand'), ...document.querySelectorAll('.text-orange')];
    if (session) {
        dynamicElements.forEach(el => el && el.classList.add('logged-in'));
    }
}
syncUI();

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('active'); if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });
changeFileBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });

function handleFile(file) {
    if (file.type !== 'application/pdf') { alert('PDF 파일만 선택 가능합니다.'); return; }
    currentFile = file;
    selectedFileName.textContent = file.name;
    defaultContent.style.display = 'none';
    fileInfo.style.display = 'flex';
    convertBtn.style.display = 'block';
    
    // Show mode selection
    const modeSelection = document.getElementById('modeSelection');
    if (modeSelection) modeSelection.style.display = 'flex';
    
    resetProgress();
}

function resetProgress() {
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
    statusText.textContent = '';
}

/**
 * Helper to reconstruct sentences from OCR text lines
 */
function reconstructParagraphs(text) {
    const lines = text.split('\n');
    const reconstructed = [];
    let currentPara = "";

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (currentPara) {
            const lastChar = currentPara.slice(-1);
            const isTerminal = '.?!:)]'.includes(lastChar);
            const startsWithLower = /^[a-z가-힣0-9]/.test(trimmed) && !/^[A-Z]/.test(trimmed);

            if (!isTerminal || startsWithLower) {
                currentPara += " " + trimmed;
            } else {
                reconstructed.push(currentPara);
                currentPara = trimmed;
            }
        } else {
            currentPara = trimmed;
        }
    });
    if (currentPara) reconstructed.push(currentPara);
    return reconstructed;
}

/**
 * Process a list of items into grouped lines of text
 */
function processItemsToText(items) {
    const lines = [];
    items.forEach(item => {
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        let line = lines.find(l => Math.abs(l.y - y) < 4);
        if (!line) {
            line = { y: y, items: [] };
            lines.push(line);
        }
        line.items.push({ text: item.str, x: x, width: item.width });
    });

    lines.sort((a, b) => b.y - a.y);
    let resultText = "";
    lines.forEach(line => {
        line.items.sort((a, b) => a.x - b.x);
        let lineText = "";
        let lastX = -1;

        line.items.forEach(it => {
            const gap = lastX !== -1 ? (it.x - lastX) : 0;
            if (gap > 60) {
                lineText += "   " + it.text;
            } else if (gap > 2) {
                lineText += " " + it.text;
            } else {
                lineText += it.text;
            }
            lastX = it.x + it.width;
        });
        resultText += lineText.trim() + "\n";
    });
    return resultText;
}

convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const convMode = document.querySelector('input[name="convMode"]:checked').value;
    convertBtn.disabled = true;
    convertBtn.textContent = '변환 중...';
    progressContainer.style.display = 'block';
    statusText.textContent = 'PDF 준비 중...';

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        if (typeof pdfjsLib === 'undefined') throw new Error('PDF 라이브러리가 로드되지 않았습니다.');
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        let finalOutput = "";

        if (convMode === 'ocr') {
            statusText.textContent = 'OCR 엔진 초기화 중 (한글/영어)...';
            const worker = await Tesseract.createWorker('kor+eng');
            
            for (let i = 1; i <= totalPages; i++) {
                statusText.textContent = `페이지 OCR 분석 중 (${i} / ${totalPages})...`;
                progressBar.style.width = `${(i / totalPages) * 90}%`;

                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                // Crop into columns
                const midX = canvas.width / 2;
                const columns = [
                    { x: 0, y: 0, w: midX, h: canvas.height },
                    { x: midX, y: 0, w: midX, h: canvas.height }
                ];

                for (const col of columns) {
                    const colCanvas = document.createElement('canvas');
                    colCanvas.width = col.w;
                    colCanvas.height = col.h;
                    const colCtx = colCanvas.getContext('2d');
                    colCtx.drawImage(canvas, col.x, col.y, col.w, col.h, 0, 0, col.w, col.h);
                    
                    const { data: { text } } = await worker.recognize(colCanvas);
                    const cleaned = reconstructParagraphs(text);
                    finalOutput += cleaned.join('\n\n') + "\n\n";
                }
                finalOutput += "\n--- 페이지 구분 ---\n\n";
            }
            await worker.terminate();
        } else if (convMode === 'column') {
            for (let i = 1; i <= totalPages; i++) {
                statusText.textContent = `2단 분리 분석 중 (${i} / ${totalPages})...`;
                progressBar.style.width = `${(i / totalPages) * 90}%`;

                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.0 });
                const midX = viewport.width / 2;
                const textContent = await page.getTextContent();
                
                const leftItems = [];
                const rightItems = [];
                textContent.items.forEach(item => {
                    if (item.transform[4] < midX) leftItems.push(item);
                    else rightItems.push(item);
                });

                finalOutput += processItemsToText(leftItems);
                finalOutput += "\n[우측 단 시작]\n";
                finalOutput += processItemsToText(rightItems);
                finalOutput += "\n--- 페이지 구분 ---\n\n";
            }
        } else {
            // Standard Layout Mode
            for (let i = 1; i <= totalPages; i++) {
                statusText.textContent = `페이지 추출 중 (${i} / ${totalPages})...`;
                progressBar.style.width = `${(i / totalPages) * 90}%`;
                const page = await pdf.getPage(i);
                finalOutput += processItemsToText((await page.getTextContent()).items);
                finalOutput += "\n--- 페이지 구분 ---\n\n";
            }
        }

        const blob = new Blob([finalOutput], { type: 'text/plain;charset=utf-8' });
        const suffixMap = { layout: "_Extracted.hwpx", column: "_2Column.hwpx", ocr: "_OCR.hwpx" };
        saveAs(blob, currentFile.name.replace('.pdf', '') + (suffixMap[convMode] || ".hwpx"));

        progressBar.style.width = '100%';
        statusText.textContent = '변환 완료! (텍스트 기반 HWPX)';
        convertBtn.textContent = '다시 변환하기';
        convertBtn.disabled = false;
    } catch (error) {
        console.error(error);
        statusText.textContent = `오류 발생: ${error.message}`;
        convertBtn.disabled = false;
        convertBtn.textContent = '다시 시도 🚀';
    }
});
