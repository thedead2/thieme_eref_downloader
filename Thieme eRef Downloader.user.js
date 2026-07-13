// ==UserScript==
// @name         Thieme eRef Downloader
// @version      1.5
// @description  Download all PDFs and merge them into a single file
// @author       The_Dead_2, Revezd
// @include      https://eref.thieme.de/ebooks/*
// @include      */ebooks/*
// @require      https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js
// ==/UserScript==

(function () {
    'use strict';

    let pdfs = [];
    let name = document.getElementsByClassName("lineTwo")[0]?.textContent?.trim() + " - " + document.getElementsByClassName("lineOne")[0]?.textContent?.trim()|| "UnkownBook";
    let indx = 0;
    let timeout = 60000;

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    console.log("Worker online");


    function createProgressUI() {
        removeProgressUI(); 

        let progressContainer = document.createElement("div");
        progressContainer.id = "progressContainer";
        
        progressContainer.style.position = "fixed";
        progressContainer.style.inset = "auto 20px 20px auto"; 
        progressContainer.style.margin = "0";

        progressContainer.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
        progressContainer.style.color = "#ffffff";
        progressContainer.style.padding = "12px 16px";
        progressContainer.style.borderRadius = "8px";
        progressContainer.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
        progressContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        progressContainer.style.fontSize = "14px";
        progressContainer.style.fontWeight = "bold";
        progressContainer.style.zIndex = "2147483647"; 
        progressContainer.style.pointerEvents = "none"; 
        
        progressContainer.innerText = "Downloading: 0 / 0";

        
        if (HTMLElement.prototype.hasOwnProperty("popover")) {
            progressContainer.popover = "manual";
            document.body.appendChild(progressContainer);
            progressContainer.showPopover();
        } 
        else {
            const t = document.querySelector('t-dialog[dialog-id="pdfDialog"]');
            const dialogEl = t && t.shadowRoot ? t.shadowRoot.querySelector('dialog') : null;
            
            if (dialogEl && dialogEl.hasAttribute('open')) {
                dialogEl.appendChild(progressContainer);
            } 
            else {
                document.body.appendChild(progressContainer);
            }
        }
    }

    function updateProgressUI(text, current, total) {
        let progressContainer = document.getElementById("progressContainer");
        if (progressContainer) {
            progressContainer.innerText = `${text} (${(current / total * 100).toFixed(0)} %)`;
        }
    }

    function removeProgressUI() {
        let progressContainer = document.getElementById("progressContainer");
        if (progressContainer) {
            progressContainer.remove();
        }
    }

    function waitForElement(selector, callback) {
        const observer = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === "childList") {
                    const element = document.querySelector(selector);
                    if (element) {
                        observer.disconnect();
                        callback(element);
                        return;
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function hashString(string) {
        let hash = 0;
        for (let i = 0; i < string.length; i++) {
            const char = string.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    function truncateString(str, num) {
    if (str.length > num) {
        return str.slice(0, num) + "...";
    } else {
        return str;
    }
}

    async function extractTextFromPDF(arrayBuffer) {
        const CMAP_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/cmaps/';

        const loadingTask = pdfjsLib.getDocument({ 
            data: arrayBuffer,
            cMapUrl: CMAP_URL,
            cMapPacked: true,
            disableFontFace: true 
        });
        
        const pdf = await loadingTask.promise;
        const textContents = [];

        for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
            try {
                const page = await pdf.getPage(pageIndex);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item) => item.str).join(" ");
                textContents.push(pageText);
                
                page.cleanup();
            } catch (e) {
                console.warn(`Warning: Could not extract text for page ${pageIndex}. Skipping deduplication for this page.`, e);
                textContents.push(`Fallback_Page_${pageIndex}_${Math.random()}`); 
            }
        }

        await loadingTask.destroy();

        return textContents;
    }

    async function downloadAndMergePDFs(files) {
        if (files.length === 0) {
            alert("Couldn't find any pdfs to download!");
            return;
        }

        updateProgressUI("Starting process...", 0, files.length);

        try {
            const mergedPdf = await PDFLib.PDFDocument.create();
            const uniquePages = new Set();
            let processedCount = 0;

            for (const file of files) {
                const shortName = truncateString(file.filename, 30);
                updateProgressUI(`Processing: ${shortName}`, processedCount + 1, files.length);

                let pdfBlob = await downloadPDF(file);
                let pdfArrayBuffer = await pdfBlob.arrayBuffer();

                const textContents = await extractTextFromPDF(pdfArrayBuffer);

                let pdfDoc = await PDFLib.PDFDocument.load(pdfArrayBuffer);
                for (let i = 0; i < textContents.length; i++) {
                    const pageHash = hashString(textContents[i]);

                    if (!uniquePages.has(pageHash)) {
                        uniquePages.add(pageHash);
                        const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [i]);
                        mergedPdf.addPage(copiedPage);
                    }
                }

                pdfDoc = null;
                pdfArrayBuffer = null;
                pdfBlob = null;

                await new Promise(resolve => setTimeout(resolve, 150));
                
                processedCount++;
            }

            updateProgressUI("Generating final PDF... (This may take a moment)", processedCount, files.length);

            const mergedPdfBytes = await mergedPdf.save({ useObjectStreams: false });
            const mergedBlob = new Blob([mergedPdfBytes], { type: "application/pdf" });
            
            const downloadUrl = URL.createObjectURL(mergedBlob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `${name}.pdf`;
            document.body.appendChild(a);
            a.click();
            
            URL.revokeObjectURL(downloadUrl);
            a.remove();

            updateProgressUI("Download complete!", processedCount, files.length);
            await new Promise(resolve => setTimeout(resolve, 5000));

        } 
        catch (error) {
            alert("An error occurred while downloading:\n" + error.message);
            console.error("Error detailing:", error);
        } 
        finally {
            removeProgressUI();
        }
    }

    async function downloadPDF(file) {
        const downloadPromise = fetch(file.download).then((response) => {
            if (!response.ok) throw new Error(`Error fetching: ${file.filename}`);
            return response.blob();
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Network Timeout for: ${file.filename}`)), timeout)
        );

        return await Promise.race([downloadPromise, timeoutPromise]);
    }

    function getBaseUrl() {
        let url = String(window.location);
        return url.substring(0, url.indexOf("/ebooks"));
    }

    function findAllInShadow(root, selector) {
        let results = [...root.querySelectorAll(selector)];
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                results = results.concat(findAllInShadow(el.shadowRoot, selector));
            }
        });
        return results;
    }

    function downloadAllPdfs() {
        console.log("clicked");
        let indx = 0;
        let pdfs = [];

        const elements = findAllInShadow(document, 't-toc-entry');
        elements.forEach(el => {
            const pdfLink = el.getAttribute("pdf-link");
            const title = el.getAttribute("title");
            if (pdfLink && pdfLink.includes(".pdf")) {
                indx++;
                pdfs.push({
                    download: getBaseUrl() + pdfLink,
                    filename: indx.toString().padStart(3, "0") + "_" + title + ".pdf"
                });
            }
        });

        console.log(pdfs);

        if (pdfs.length > 0) {
            createProgressUI();
            updateProgressUI("Downloading", 0, pdfs.length);
            downloadAndMergePDFs(pdfs);
        } 
        else {
            alert("Couldn't find any pdfs to download!");
        }
    }


    function createFloatingButton() {
        const existing = document.getElementById('pdf-download-all-btn');
        if (existing) existing.remove();

        const host = document.createElement('div');
        host.id = 'pdf-download-all-btn';
        host.style.cssText = `
        all: initial !important;
        position: absolute !important;
        top: 12px !important;
        right: 66px !important;
        z-index: 999999 !important;
    `;

        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            button {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 9px 16px;
                background: #2563eb;
                color: #ffffff;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.15s ease, transform 0.1s ease;
            }
            button:hover {
                background: #1d4ed8;
            }
            button:active {
                background: #1e40af;
                transform: scale(0.97);
            }
            button:focus-visible {
                outline: 2px solid #93c5fd;
                outline-offset: 2px;
            }
            svg {
                width: 16px;
                height: 16px;
                flex-shrink: 0;
            }
        </style>
        <button type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download all</span>
        </button>
    `;

        shadow.querySelector('button').addEventListener('click', downloadAllPdfs);

        attachDialogWatcher(host);

        return host;
    }

    function attachDialogWatcher(host) {
        const t = document.querySelector('t-dialog[dialog-id="pdfDialog"]');
        if (!t || !t.shadowRoot) {
            setTimeout(() => attachDialogWatcher(host), 500);
            return;
        }
        const dialogEl = t.shadowRoot.querySelector('dialog');
        if (!dialogEl) {
            setTimeout(() => attachDialogWatcher(host), 500);
            return;
        }

        const sync = () => {
            if (!dialogEl.contains(host)) {
                dialogEl.appendChild(host);
            }
            host.style.display = dialogEl.hasAttribute('open') ? 'block' : 'none';
        };

        const attrObserver = new MutationObserver(sync);
        attrObserver.observe(dialogEl, { attributes: true, attributeFilter: ['open'] });

        const contentObserver = new MutationObserver(sync);
        contentObserver.observe(dialogEl, { childList: true });

        sync();
    }

    let btnHost = createFloatingButton();

    const watchdog = new MutationObserver(() => {
        if (!document.getElementById('pdf-download-all-btn')) {
            btnHost = createFloatingButton();
        }
    });
    watchdog.observe(document.body, { childList: true, subtree: true });
})();
