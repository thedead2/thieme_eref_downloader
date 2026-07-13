# Thieme eRef Downloader

Downloading a complete e-book from the Thieme eRef is an incredibly tedious and time-consuming task. You have to go through every single subchapter of the book you want and manually download them one by one. Then you have to merge all the downloaded PDFs and remove pages that appear more than once.

This Thieme eRef Downloader does all that for you in a fraction of the time, with just the click of a button. 

## How to use it?
1. You need valid authentication to access the books in Thieme eRef (e.g. through your institution or an active subscription).
2. You need to install a browser extension that can execute JavaScript code directly on a website (e.g. [Userscripts for Safari](https://github.com/quoid/userscripts) or [Tampermonkey for Firefox, Chrome, etc.](https://www.tampermonkey.net/index.php?locale=en)). *Make sure to enable it!*
3. Download the `Thieme eRef Downloader.user.js` file and place it in your browser extension's script location. Or simply copy the raw code and paste it into the editor of the browser extension of your choice.
4. Go to Thieme eRef, find the book you want to download and under the `PDF` section you will find a `Download All` button.
5. Press the button and wait until the downloader notifies you, that your download is complete. The progress of your download will be displayed in the bottom right corner of your browser window.

<img width="1703" height="894" alt="Screenshot of the Thieme eRef site with download all button" src="https://github.com/user-attachments/assets/c37c0e10-20df-4e02-b454-a0b185955f2e" />


*Important: Do not leave the website during the download as this will cause the download to stop!*

*Please note: Depending on the size of the e-book downloading and merging the files may take a few minutes!*

*You might find that there are missing pages in the final pdf. These missing pages are generally completely white pages without any content. This is due to the way the script compares the content of pdf pages and can not be avoided but as these pages have no content this flaw is unimportant!*

## Disclaimer
Use at your own risk. This project is for educational purposes only. I am not responsible for any misuse of the software. Depending on your jurisdiction, it may be illegal to use this software to download the e-books in their entirety without the publisher's permission. In other jurisdictions, it may be legal to download e-books for personal use only. Please check your local laws before using this software.
