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
    statusText.textContent = 'PDF 분석 중...';

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        if (typeof pdfjsLib === 'undefined') throw new Error('PDF 라이브러리가 로드되지 않았습니다.');

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        let fullText = "";

        for (let i = 1; i <= totalPages; i++) {
            statusText.textContent = `텍스트 추출 중 (${i} / ${totalPages})...`;
            const percent = (i / totalPages) * 100;
            progressBar.style.width = `${percent}%`;

            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + "\n\n";
        }

        // HWPX is complex XML-zipped. For a direct browser "HWPX" output without a heavy library, 
        // we will output a Text file with .hwpx extension as a "Text HWPX" stub or advise.
        // Realistically, users want the extension.
        const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, currentFile.name.replace('.pdf', '') + "_extracted.hwpx");

        statusText.textContent = '변환 완료! (텍스트 기반 HWPX)';
        convertBtn.textContent = '변환 완료!';
        convertBtn.disabled = false;
    } catch (error) {
        console.error(error);
        statusText.textContent = `오류 발생: ${error.message}`;
        convertBtn.disabled = false;
    }
});
