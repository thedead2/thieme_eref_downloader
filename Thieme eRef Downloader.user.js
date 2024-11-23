// ==UserScript==
// @name         Thieme eRef Downloader
// @version      1.3
// @description  Download all PDFs and merge them into a single file
// @author       The_Dead_2
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


    function createProgressUI() {
        let progressContainer = document.createElement("div");
        progressContainer.id = "progressContainer";
        progressContainer.style.position = "fixed";
        progressContainer.style.bottom = "10px";
        progressContainer.style.right = "10px";
        progressContainer.style.backgroundColor = "rgba(0,0,0,0.7)";
        progressContainer.style.color = "white";
        progressContainer.style.padding = "10px";
        progressContainer.style.borderRadius = "5px";
        progressContainer.style.zIndex = "1000";
        progressContainer.style.fontSize = "14px";
        progressContainer.innerText = "Downloading: 0 / 0";
        document.body.appendChild(progressContainer);
    }

    function updateProgressUI(text, current, total) {
        let progressContainer = document.getElementById("progressContainer");
        if (progressContainer) {
            progressContainer.innerText = `${text}: ${current} / ${total}`;
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

    function downloadAndMergePDFs(files) {
        if (files.length > 0) {
            updateProgressUI("Downloading", 0, files.length);

            downloadAllPDFs(files).then((pdfBlobs) => {
                if (pdfBlobs.length > 0) {
                    mergeAllPDFs(pdfBlobs);
                } else {
                    alert("Couldn't find any valid pdfs!");
                    removeProgressUI();
                }
            }).catch((error) => {
                alert("Couldn't download or merge pdfs:\n" + error);
                console.error("Couldn't download or merge pdfs:", error);
                removeProgressUI();
            });
        } else {
            alert("Couldn't find any pdfs to download!");
        }
    }

    async function downloadAllPDFs(files) {
        let downloadedCount = 0;

        const pdfBlobs = await Promise.all(
            files.map(async (file) => {
                const downloadPromise = fetch(file.download)
                    .then((response) => {
                        if (!response.ok) throw new Error(`Error fetching: ${file.filename}`);

                        downloadedCount++;
                        updateProgressUI("Downloading", downloadedCount, files.length);

                        return response.blob();
                    });
    
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Network Timeout for: ${file.filename}`)), timeout)
                );
    
                return await Promise.race([downloadPromise, timeoutPromise]);
            })
        );

        return pdfBlobs.filter((blob) => blob !== null);
    }

    async function extractTextFromPDF(arrayBuffer) {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const textContents = [];

        for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
            const page = await pdf.getPage(pageIndex);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(" ");
            textContents.push(pageText);
        }

        return textContents;
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

    async function mergeAllPDFs(pdfBlobs) {
        const mergedPdf = await PDFLib.PDFDocument.create();
        const uniquePages = new Set();
        let mergedCount = 0;

        for (const pdfBlob of pdfBlobs) {
            const pdfArrayBuffer = await pdfBlob.arrayBuffer();
            const textContents = await extractTextFromPDF(pdfArrayBuffer);

            for (let i = 0; i < textContents.length; i++) {
                const pageHash = hashString(textContents[i]);

                if (!uniquePages.has(pageHash)) {
                    uniquePages.add(pageHash);

                    const pdfDoc = await PDFLib.PDFDocument.load(pdfArrayBuffer);
                    const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [i]);
                    mergedPdf.addPage(copiedPage);
                }
            }
            
            mergedCount++;
            updateProgressUI("Merging", mergedCount, pdfBlobs.length);
        }

        const mergedPdfBytes = await mergedPdf.save();
        const mergedBlob = new Blob([mergedPdfBytes], { type: "application/pdf" });
        const downloadUrl = URL.createObjectURL(mergedBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${name}.pdf`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(downloadUrl);
        a.remove();

        alert("Download complete!");
        removeProgressUI();
    }

    function getBaseUrl() {
        let url = String(window.location);
        return url.substring(0, url.indexOf("/ebooks"));
    }

    waitForElement(".toc-tree", (tocTree) => {
        let downAllLi = document.createElement("li");
        let downAll = document.createElement("input");
        downAll.type = 'button';
        downAll.value = "Download All";

        downAll.addEventListener('click', function () {
            let elements = document.getElementsByClassName("tocPdfContainer");
            indx = 0;
            pdfs = [];
            for (let i = 0; i < elements.length; i++) {
                let pdfLink = elements[i].getAttribute("data-pdf-link");
                if (pdfLink && pdfLink.includes(".pdf")) {
                    indx++;
                    pdfs.push({
                        download: getBaseUrl() + pdfLink,
                        filename: indx.toString().padStart(3, "0") + "_" + name + ".pdf"
                    });
                }
            }
            if (pdfs.length > 0) {
                createProgressUI();
                updateProgressUI("Downloading", 0, pdfs.length);
                downloadAndMergePDFs(pdfs);
            } else {
                alert("Couldn't find any pdfs to download!");
            }
        }, false);

        downAllLi.appendChild(downAll);
        tocTree.insertBefore(downAllLi, tocTree.firstChild);
    });
})();
