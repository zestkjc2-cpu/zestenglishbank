/**
 * questionEngine.js
 * 
 * Pure functions for AI Recommendation, Text transformation and Question Generation
 */

export function applyPassageTransformation(text, currentTransMode) {
    if (!text) return "";
    
    switch (currentTransMode) {
        case 'before':
            return "[Introductory Context Added] In light of modern perspectives, it is essential to consider the following background: " + text;
        case 'after':
            return text + " [Concluding Context Added] Ultimately, this highlights the broader implications of the theory discussed above.";
        case 'between':
            const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
            if (sentences.length > 2) {
                const mid = Math.floor(sentences.length / 2);
                sentences.splice(mid, 0, " [Modified transition for internal context] Furthermore, this specific aspect suggests a deeper layer of complexity. ");
                return sentences.join("");
            }
            return text + " [Modified internally]";
        default:
            return text;
    }
}

export function analyzePassage(text) {
    const lowerText = text.toLowerCase();
    const recommendedCategories = [];
    const recommendedSubItems = [];

    if (text.length > 100) {
        recommendedCategories.push("대의 파악");
        recommendedSubItems.push("주제/제목/요지/주장 찾기");
    }

    const connectors = ["however", "therefore", "moreover", "furthermore", "instead", "nonetheless", "first", "second", "finally", "consequently"];
    if (connectors.some(word => lowerText.includes(word))) {
        recommendedCategories.push("논리적 흐름");
        recommendedSubItems.push("연결어 추론");
        recommendedSubItems.push("문장 삽입");
        recommendedSubItems.push("글의 순서 배열");
    }

    const purposeWords = ["want", "please", "request", "sincerely", "inform", "announce", "offer", "purpose"];
    if (purposeWords.some(word => lowerText.includes(word))) {
        recommendedCategories.push("대의 파악");
        recommendedSubItems.push("글의 목적");
    }

    const sentimentWords = ["happy", "sad", "afraid", "scared", "beautiful", "dark", "bright", "lonely", "excited", "nervous", "angry"];
    if (sentimentWords.some(word => lowerText.includes(word))) {
        recommendedCategories.push("대의 파악");
        recommendedSubItems.push("심경 및 분위기");
    }

    if (text.length > 300) {
        recommendedCategories.push("세부 정보 및 추론");
        recommendedSubItems.push("내용 일치/불일치");
        recommendedSubItems.push("빈칸 추론");
    }

    recommendedCategories.push("어법 및 어휘");
    recommendedSubItems.push("어법상 어색한/적절한 것");
    recommendedSubItems.push("문맥상 어색한/적절한 어휘");
    if (text.length > 400) recommendedSubItems.push("요약문 완성");

    if (text.length > 250) {
        recommendedCategories.push("서술형");
        recommendedSubItems.push("단어 배열 영작");
        recommendedSubItems.push("우리말 해석 및 요약");
    }

    return { recommendedCategories, recommendedSubItems };
}

export function createMultipleChoiceQuestion(text, typeTitle) {
    const words = text.match(/\b[a-zA-Z]{5,}\b/g) || ["learning", "concept", "education", "development", "process"];
    const uniqueWords = [...new Set(words.map(w => w.toLowerCase()))];
    uniqueWords.sort(() => 0.5 - Math.random());
    
    const fallbacks = ["system", "approach", "understanding", "analysis", "framework", "perspective", "evidence", "theory"];
    while (uniqueWords.length < 10) uniqueWords.push(fallbacks.pop());

    const templates = [
        "The role of {0} in modern {1}",
        "How {0} affects the {1}",
        "Understanding the importance of {0}",
        "The relationship between {0} and {1}",
        "New perspectives on {0} development",
        "The impact of {0} on our {1}",
        "Why {0} matters in the context of {1}",
        "Comparing {0} with traditional {1}",
        "The hidden meaning behind {0}",
        "Strategies for improving {0}"
    ];
    templates.sort(() => 0.5 - Math.random());

    const generatedOptions = [];
    for(let i = 0; i < 5; i++) {
        let tpl = templates[i];
        let w1 = uniqueWords[i * 2 % uniqueWords.length];
        let w2 = uniqueWords[(i * 2 + 1) % uniqueWords.length];
        let opt = tpl.replace("{0}", w1).replace("{1}", w2);
        opt = opt.charAt(0).toUpperCase() + opt.slice(1);
        generatedOptions.push(opt);
    }
    
    const answerIndex = Math.floor(Math.random() * 5);
    const answerLabels = ['①', '②', '③', '④', '⑤'];

    let questionText = `다음 글의 제목이나 요지로 가장 적절한 것을 고르시오.`;
    if (typeTitle.includes("빈칸") || typeTitle.includes("일치") || typeTitle.includes("추론") || typeTitle.includes("순서")) {
        questionText = `다음 글에 대한 설명으로 가장 적절한 것을 고르시오.`;
    }

    return {
        type: 'multiple',
        typeTitle: typeTitle,
        question: questionText,
        passage: text,
        options: generatedOptions,
        answer: answerLabels[answerIndex]
    };
}

export function createGrammarQuestion(text, typeTitle) {
    const grammarPoints = [
        { regex: /\b(is|are|was|were)\b/gi, choices: (m) => m.toLowerCase() === 'is' || m.toLowerCase() === 'was' ? ['is', 'are'] : ['are', 'is'] },
        { regex: /\b(which|that|who)\b/gi, choices: () => ['which', 'that'] },
        { regex: /(\w+ing)\b/gi, choices: (m) => [m, m.replace('ing', 'ed')] },
    ];

    let processedText = text;
    const answers = [];
    grammarPoints.forEach(point => {
        processedText = processedText.replace(point.regex, (match) => {
            if (answers.length < 3 && Math.random() > 0.5) {
                const choices = point.choices(match);
                answers.push(match);
                return `[ ${choices[0]} / ${choices[1]} ]`;
            }
            return match;
        });
    });

    return {
        type: 'grammar',
        typeTitle: typeTitle,
        passage: processedText,
        answer: answers.join(', ')
    };
}

export function createOrderingQuestion(text, typeTitle) {
    const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
    const targetIdx = Math.floor(Math.random() * sentences.length);
    const targetSentence = sentences[targetIdx].trim();
    const words = targetSentence.replace(/[.\?]/, '').split(' ');
    const scrambled = [...words].sort(() => Math.random() - 0.5);

    let newPassage = "";
    sentences.forEach((s, i) => {
        if (i === targetIdx) newPassage += ` ( 1 ) `;
        else newPassage += s + " ";
    });

    return {
        type: 'ordering',
        typeTitle: typeTitle,
        question: `다음 밑줄 친 ( 1 )의 우리말과 일치하도록 <보기>의 단어들을 바르게 배열하시오.`,
        passage: newPassage,
        box: scrambled.join(' / '),
        answer: targetSentence
    };
}

export function createSubjectiveQuestion(text, typeTitle) {
    const words = text.match(/\b[a-zA-Z]{5,}\b/g) || ["learning", "concept", "education", "development"];
    const w1 = words[Math.floor(Math.random() * words.length)].toLowerCase();
    
    return {
        type: 'subjective',
        typeTitle: typeTitle,
        question: `다음 지문의 핵심 내용을 요약할 때, 본문에서 적절한 단어를 찾아 쓰시오.`,
        passage: text,
        answer: `The importance of ${w1} in this context.`
    };
}

export function generatePreviewItems(text, selectedTypes, currentTransMode) {
    const modifiedPassage = applyPassageTransformation(text, currentTransMode);
    const previewBuffer = [];

    selectedTypes.forEach((type, idx) => {
        let q;
        if (type.includes('주제') || type.includes('목적') || type.includes('심경')) {
            q = createMultipleChoiceQuestion(modifiedPassage, type);
        } else if (type.includes('순서') || type.includes('삽입') || type.includes('무관') || type.includes('연결')) {
            q = createOrderingQuestion(modifiedPassage, type);
        } else if (type.includes('일치') || type.includes('빈칸') || type.includes('의미') || type.includes('지칭')) {
            q = createMultipleChoiceQuestion(modifiedPassage, type);
        } else if (type.includes('어법') || type.includes('어휘') || type.includes('요약')) {
            q = createGrammarQuestion(modifiedPassage, type);
        } else if (type.includes('영작') || type.includes('해석')) {
            q = createSubjectiveQuestion(modifiedPassage, type);
        } else {
            q = createMultipleChoiceQuestion(modifiedPassage, type);
        }
        
        if (q) {
            previewBuffer.push(q);
        }
    });
    return previewBuffer;
}
