/**
 * pdfExtractor.js
 * 
 * Pure functions for PDF text extraction and processing.
 * Extracted from converter.js to separate business logic from UI.
 */

/**
 * Heuristic to merge lines into a single sentence for Exam Questions
 */
export function reconstructParagraphs(text) {
    const rawLines = text.split('\n');
    let reconstructed = [];
    let currentPara = "";

    rawLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
            if (currentPara) reconstructed.push(currentPara);
            currentPara = "";
            return;
        }

        if (currentPara) {
            // Join if previous doesn't end with terminal or current starts with lowercase
            const lastChar = currentPara.trim().slice(-1);
            const isTerminal = '.?!'.includes(lastChar);
            const firstChar = trimmed[0];
            const startsWithLower = /^[a-z]/.test(firstChar);

            if (!isTerminal || startsWithLower) {
                if (lastChar === '-' && startsWithLower) {
                    currentPara = currentPara.trim().slice(0, -1) + trimmed;
                } else {
                    currentPara += " " + trimmed;
                }
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
 * Process a list of items into grouped lines of text (paragraphs)
 */
export function processItemsToParagraphs(items, docxComponents) {
    const { Paragraph, TextRun } = docxComponents;
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
    const paragraphs = [];
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

        paragraphs.push(new Paragraph({
            children: [new TextRun({ text: lineText.trim(), size: 24, font: "Pretendard" })],
            spacing: { before: 200, after: 200 }
        }));
    });
    return paragraphs;
}

export function getBlocksFromItems(items, pageHeight, { Paragraph, TextRun }) {
    if (items.length === 0) return [];

    // Noise filtering (Y-axis) - slightly more generous range
    const topLimit = pageHeight * 0.98; // Adjusted from 0.95
    const bottomLimit = pageHeight * 0.02; // Adjusted from 0.05
    
    const filtered = items.filter(it => {
        const y = it.transform[5];
        return y < topLimit && y > bottomLimit && it.str.trim().length > 0;
    });

    if (filtered.length === 0) return [];
    
    const paras = [];

    // Grouping by Y-lines
    const lines = [];
    filtered.forEach(it => {
        const y = Math.round(it.transform[5]);
        let line = lines.find(l => Math.abs(l.y - y) < 4);
        if (!line) {
            line = { y: y, items: [] };
            lines.push(line);
        }
        line.items.push({ text: it.str, x: it.transform[4], w: it.width });
    });
    lines.sort((a, b) => b.y - a.y);

    const blocks = [];
    let currentBlock = [];

    // Enhanced heuristic: "1.", "1)", "1-2.", "[1-5]", "Q1", "번호", "문제" etc.
    const questionStartRegex = /^([가-힣]{1,2}\d{0,3}[\.\)]?\s|[\d]{1,3}[\.\)]|\[[0-9]{1,3}([-~][0-9]{1,3})?\]|◈|◆|Q\d+|[*●■])|^\d+\s/;

    lines.forEach(line => {
        line.items.sort((a, b) => a.x - b.x);
        const lineText = line.items.map(it => it.text).join(" ").replace(/\s+/g, ' ').trim();
        if (!lineText) return;

        if (questionStartRegex.test(lineText)) {
            if (currentBlock.length > 0) blocks.push(currentBlock);
            currentBlock = [lineText];
        } else {
            // Fallback: If no block started yet but we have text, start a default block
            if (currentBlock.length === 0) currentBlock = [lineText];
            else currentBlock.push(lineText);
        }
    });
    if (currentBlock.length > 0) blocks.push(currentBlock);

    if (blocks.length === 0 && filtered.length > 0) {
        // Extreme fallback: just wrap all filtered lines
        const allText = lines.map(l => l.items.map(i=>i.text).join(" ")).join("\n");
        blocks.push([allText]);
    }

    blocks.forEach(block => {
        let currentMergedPara = "";
        
        block.forEach((line, idx) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            // Merge logic: If previous does NOT end with a period, join onto same line.
            const isQuestionStart = questionStartRegex.test(trimmedLine);
            const lastChar = currentMergedPara.trim().slice(-1);
            const isTerminal = '.?!'.includes(lastChar);
            
            // Treat colon (:) as a break too if it's likely a header
            const isHeaderBreak = currentMergedPara.includes(':') && currentMergedPara.length < 50;

            if (idx === 0 || isQuestionStart || isTerminal || isHeaderBreak) {
                if (currentMergedPara) {
                    paras.push(new Paragraph({
                        children: [new TextRun({ text: currentMergedPara, font: "Pretendard", size: 24 })],
                        spacing: { before: 150, after: 150 }
                    }));
                }
                currentMergedPara = trimmedLine;
            } else {
                // Word-joining logic: Handle hyphens and word breaks
                const firstChar = trimmedLine[0];
                if (lastChar === '-' && /^[a-z]/.test(firstChar)) {
                    // Remove hyphen and join without space
                    currentMergedPara = currentMergedPara.trim().slice(0, -1) + trimmedLine;
                } else {
                    // Standard join with space
                    currentMergedPara += " " + trimmedLine;
                }
            }
        });

        if (currentMergedPara) {
            paras.push(new Paragraph({
                children: [new TextRun({ 
                    text: currentMergedPara, 
                    font: "Pretendard", 
                    size: 24,
                    bold: questionStartRegex.test(currentMergedPara.split(' ')[0])
                })],
                spacing: { before: 150, after: 150 }
            }));
        }
    });

    return paras;
}

/**
 * Smart extraction for exam questions:
 * 1. Handles 2-column split internally
 * 2. Filters out headers/footers
 * 3. Groups items into "Question Blocks" starting with "1.", "2.", "3.", etc.
 */
export async function extractQuestionBlocks(page, docxComponents) {
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();
    const items = content.items;
    
    if (items.length === 0) return [];

    // --- Dynamic Column Detection (Peak Alignment) ---
    const xFreq = {};
    const searchMin = Math.floor(viewport.width * 0.15);
    const searchMax = Math.floor(viewport.width * 0.85);

    items.forEach(it => {
        const x = Math.round(it.transform[4] / 10) * 10; // Bucket by 10px
        if (x < searchMin || x > searchMax) return;
        xFreq[x] = (xFreq[x] || 0) + 1;
    });

    // Find the two highest peaks that are sufficiently far apart
    const sortedX = Object.keys(xFreq).sort((a, b) => xFreq[b] - xFreq[a]);
    let peakLeft = -1;
    let peakRight = -1;

    for (const xStr of sortedX) {
        const x = parseInt(xStr);
        if (peakLeft === -1) {
            peakLeft = x;
        } else if (Math.abs(x - peakLeft) > viewport.width * 0.25) {
            peakRight = x;
            break;
        }
    }

    let midX = viewport.width / 2;
    if (peakLeft !== -1 && peakRight !== -1) {
        midX = (peakLeft + peakRight) / 2;
    } else {
        // Fallback to previous density method if peaks aren't clear
        const shadowArr = new Int32Array(Math.ceil(viewport.width));
        items.forEach(it => {
            const xStart = Math.max(0, Math.floor(it.transform[4]));
            const xEnd = Math.min(shadowArr.length - 1, Math.ceil(it.transform[4] + (it.width || 0)));
            for (let xi = xStart; xi <= xEnd; xi++) shadowArr[xi]++;
        });
        
        let minDensity = Infinity;
        for (let xi = Math.floor(viewport.width * 0.3); xi <= Math.floor(viewport.width * 0.7); xi++) {
            if (shadowArr[xi] < minDensity) {
                minDensity = shadowArr[xi];
                midX = xi;
            }
        }
    }
    const leftItems = items.filter(it => it.transform[4] < midX);
    const rightItems = items.filter(it => it.transform[4] >= midX);

    const leftParas = getBlocksFromItems(leftItems, viewport.height, docxComponents);
    const rightParas = getBlocksFromItems(rightItems, viewport.height, docxComponents);
    const { Paragraph, PageBreak } = docxComponents;

    if (leftParas.length > 0 && rightParas.length > 0) {
        return [...leftParas, new Paragraph({ children: [new PageBreak()] }), ...rightParas];
    }
    return [...leftParas, ...rightParas];
}
