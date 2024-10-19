// ==UserScript==
// @name         AnimeTosho Subtitle Downloader (Batch Download)
// @namespace    http://tampermonkey.net/
// @version      4.9
// @description  Tự động lấy và tải phụ đề đã chọn cho tất cả các tập trên animetosho.org, với giao diện tiến trình nâng cao và cột trạng thái tải
// @author
// @match        https://animetosho.org/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let allSubtitles = []; // Lưu trữ phụ đề của tất cả các tập phim

    // Hàm thu thập tất cả các liên kết tập phim
    function collectEpisodeLinks() {
        let episodeLinks = [];
        const links = document.querySelectorAll('.view_list_entry .link a');
        links.forEach(link => {
            episodeLinks.push({
                title: link.innerText.trim(),
                href: link.href
            });
        });
        return episodeLinks;
    }

    // Hàm lấy phụ đề từ trang tập phim
    async function fetchSubtitlesFromEpisode(episode) {
        try {
            const response = await fetch(episode.href);
            if (!response.ok) {
                throw new Error(`Network response was not ok for ${episode.href}`);
            }
            const pageContent = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(pageContent, 'text/html');
            const subtitlesRow = Array.from(doc.querySelectorAll('tr')).find(row => row.querySelector('th')?.innerText.includes('Subtitles'));
            let subtitles = [];
            if (subtitlesRow) {
                const subtitleLinks = subtitlesRow.querySelectorAll('a');
                subtitleLinks.forEach(link => {
                    const fullText = link.innerText;
                    const formatMatch = link.innerText.match(/\[(.*?),\s*(ASS|SRT|VTT)\]/i);
                    if (formatMatch) {
                        const language = formatMatch[1].trim();
                        const format = formatMatch[2].toUpperCase();

                        subtitles.push({
                            text: fullText, // Hiển thị đầy đủ thông tin loại phụ đề, không cắt gọt
                            href: link.href,
                            format: format,
                            language: language,
                            episodeTitle: episode.title
                        });
                    }
                });
            }
            return subtitles;
        } catch (error) {
            console.error(`Failed to fetch subtitles for ${episode.title}: ${error}`);
            return [];
        }
    }

    // Hàm tạo giao diện cho việc chọn phụ đề
    function createSubtitleUI() {
        const container = document.createElement('div');
        container.id = 'subtitle-ui-container';
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.right = '10px';
        container.style.backgroundColor = '#333';
        container.style.borderRadius = '10px';
        container.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        container.style.padding = '20px';
        container.style.color = '#fff';
        container.style.zIndex = 9999;
        container.style.maxHeight = '500px';
        container.style.overflowY = 'auto';
        container.style.width = '300px';

        const title = document.createElement('h3');
        title.innerText = 'Chọn phụ đề để tải hàng loạt';
        title.style.marginBottom = '15px';
        container.appendChild(title);

        const subtitleList = document.createElement('select');
        subtitleList.id = 'subtitle-list';
        subtitleList.style.width = '100%';
        subtitleList.style.padding = '10px';
        subtitleList.style.marginBottom = '15px';
        container.appendChild(subtitleList);

        // Thêm nút để bắt đầu quá trình lấy phụ đề
        const fetchButton = document.createElement('button');
        fetchButton.innerText = 'Lấy Phụ Đề';
        fetchButton.style.width = '100%';
        fetchButton.style.padding = '10px';
        fetchButton.style.backgroundColor = '#28a745';
        fetchButton.style.color = '#fff';
        fetchButton.style.border = 'none';
        fetchButton.style.borderRadius = '5px';
        fetchButton.style.cursor = 'pointer';
        fetchButton.style.marginBottom = '10px';

        fetchButton.addEventListener('click', async function () {
            showProgressOverlay('Đang thu thập thông tin các tập phim...', 0);
            const episodeLinks = collectEpisodeLinks();
            if (episodeLinks.length === 0) {
                console.log('Không tìm thấy tập phim nào trên trang này.');
                hideProgressOverlay();
                return;
            }

            // Lấy phụ đề cho tất cả các tập
            allSubtitles = []; // Reset phụ đề trước khi lấy lại
            for (let i = 0; i < episodeLinks.length; i++) {
                const episode = episodeLinks[i];
                showProgressOverlay(`Đang lấy phụ đề cho ${episode.title}...`, Math.floor((i / episodeLinks.length) * 100));
                const subtitles = await fetchSubtitlesFromEpisode(episode);
                allSubtitles.push({
                    episode: episode,
                    subtitles: subtitles,
                    status: subtitles.length > 0 ? 'Đã lấy phụ đề' : 'Không tìm thấy phụ đề'
                });
            }

            // Hiển thị danh sách phụ đề để người dùng chọn
            subtitleList.innerHTML = '';
            let uniqueSubtitleTexts = new Set();
            allSubtitles.forEach(episodeSubtitles => {
                episodeSubtitles.subtitles.forEach(subtitle => {
                    if (!uniqueSubtitleTexts.has(subtitle.text)) {
                        uniqueSubtitleTexts.add(subtitle.text);
                        const option = document.createElement('option');
                        option.value = subtitle.text;
                        option.innerText = subtitle.text;
                        subtitleList.appendChild(option);
                    }
                });
            });

            hideProgressOverlay();
            createStatusTable(allSubtitles); // Tạo bảng trạng thái sau khi lấy phụ đề
        });

        // Thêm nút để bắt đầu quá trình tải phụ đề
        const startButton = document.createElement('button');
        startButton.innerText = 'Tải Phụ Đề';
        startButton.style.width = '100%';
        startButton.style.padding = '10px';
        startButton.style.backgroundColor = '#007bff';
        startButton.style.color = '#fff';
        startButton.style.border = 'none';
        startButton.style.borderRadius = '5px';
        startButton.style.cursor = 'pointer';

        startButton.addEventListener('click', async function () {
            const selectedText = subtitleList.value;
            if (!selectedText) {
                alert('Bạn cần chọn một loại phụ đề để tải.');
                return;
            }
            showProgressOverlay('Đang tải phụ đề đã chọn...', 0);
            let selectedSubtitles = [];
            allSubtitles.forEach(episodeSubtitles => {
                episodeSubtitles.subtitles.forEach(subtitle => {
                    if (subtitle.text === selectedText) {
                        selectedSubtitles.push(subtitle);
                    }
                });
            });
            for (let i = 0; i < selectedSubtitles.length; i++) {
                const subtitle = selectedSubtitles[i];
                await downloadSubtitle(subtitle.href);
                showProgressOverlay(`Đang tải phụ đề ${i + 1}/${selectedSubtitles.length}`, Math.floor(((i + 1) / selectedSubtitles.length) * 100));
            }
            hideProgressOverlay();
            alert('Đã tải xong phụ đề đã chọn.');
        });

        container.appendChild(fetchButton);
        container.appendChild(startButton);
        document.body.appendChild(container);
    }

    // Hàm tải phụ đề
    function downloadSubtitle(subtitleUrl) {
        return new Promise((resolve) => {
            const link = document.createElement('a');
            link.href = subtitleUrl;
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(resolve, 1000); // Giả lập thời gian tải
        });
    }

    // Hàm tạo bảng trạng thái tải phụ đề
    function createStatusTable(allSubtitles) {
        let statusTable = document.getElementById('status-table');
        if (statusTable) {
            statusTable.remove(); // Xóa bảng trạng thái cũ nếu tồn tại
        }

        statusTable = document.createElement('div');
        statusTable.id = 'status-table';
        statusTable.style.position = 'fixed';
        statusTable.style.bottom = '10px';
        statusTable.style.left = '10px';
        statusTable.style.backgroundColor = '#333';
        statusTable.style.borderRadius = '10px';
        statusTable.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        statusTable.style.padding = '20px';
        statusTable.style.color = '#fff';
        statusTable.style.zIndex = 9999;
        statusTable.style.maxHeight = '300px';
        statusTable.style.overflowY = 'auto';
        statusTable.style.width = '500px';

        const tableTitle = document.createElement('h3');
        tableTitle.innerText = 'Trạng thái tải phụ đề';
        tableTitle.style.marginBottom = '15px';
        statusTable.appendChild(tableTitle);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        const headerRow = document.createElement('tr');
        const episodeHeader = document.createElement('th');
        episodeHeader.innerText = 'Tập phim';
        episodeHeader.style.borderBottom = '1px solid #fff';
        episodeHeader.style.padding = '5px';
        const statusHeader = document.createElement('th');
        statusHeader.innerText = 'Trạng thái';
        statusHeader.style.borderBottom = '1px solid #fff';
        statusHeader.style.padding = '5px';
        const downloadLinkHeader = document.createElement('th');
        downloadLinkHeader.innerText = 'Tải xuống';
        downloadLinkHeader.style.borderBottom = '1px solid #fff';
        downloadLinkHeader.style.padding = '5px';

        headerRow.appendChild(episodeHeader);
        headerRow.appendChild(statusHeader);
        headerRow.appendChild(downloadLinkHeader);
        table.appendChild(headerRow);

        allSubtitles.forEach(subtitle => {
            const row = document.createElement('tr');
            const episodeCell = document.createElement('td');
            episodeCell.innerText = subtitle.episode.title;
            episodeCell.style.borderBottom = '1px solid #444';
            episodeCell.style.padding = '5px';

            const statusCell = document.createElement('td');
            statusCell.innerText = subtitle.status;
            statusCell.style.borderBottom = '1px solid #444';
            statusCell.style.padding = '5px';
            statusCell.id = `status-${subtitle.episode.title}`;

            const downloadCell = document.createElement('td');
            downloadCell.style.borderBottom = '1px solid #444';
            downloadCell.style.padding = '5px';
            if (subtitle.subtitles.length > 0) {
                subtitle.subtitles.forEach(sub => {
                    const downloadLink = document.createElement('a');
                    downloadLink.href = sub.href;
                    downloadLink.innerText = 'Tải ' + sub.text;
                    downloadLink.style.display = 'block';
                    downloadLink.style.color = '#007bff';
                    downloadLink.style.textDecoration = 'none';
                    downloadCell.appendChild(downloadLink);
                });
            } else {
                downloadCell.innerText = 'Không có phụ đề';
            }

            row.appendChild(episodeCell);
            row.appendChild(statusCell);
            row.appendChild(downloadCell);
            table.appendChild(row);
        });

        statusTable.appendChild(table);
        document.body.appendChild(statusTable);
    }

    // Hàm cập nhật trạng thái
    function updateStatus(episodeTitle, status) {
        const statusCell = document.getElementById(`status-${episodeTitle}`);
        if (statusCell) {
            statusCell.innerText = status;
        }
    }

    // Hàm hiển thị thanh tiến trình tải
    function showProgressOverlay(message, progress) {
        let overlay = document.getElementById('progress-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'progress-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            overlay.style.color = '#fff';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'column';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.fontSize = '24px';
            overlay.style.zIndex = 10000;

            const messageElement = document.createElement('div');
            messageElement.id = 'progress-message';
            messageElement.style.marginBottom = '20px';
            overlay.appendChild(messageElement);

            const progressBar = document.createElement('div');
            progressBar.id = 'progress-bar';
            progressBar.style.width = '80%';
            progressBar.style.height = '30px';
            progressBar.style.backgroundColor = '#444';
            progressBar.style.borderRadius = '5px';
            progressBar.style.overflow = 'hidden';

            const progressFill = document.createElement('div');
            progressFill.id = 'progress-fill';
            progressFill.style.width = `${progress}%`;
            progressFill.style.height = '100%';
            progressFill.style.backgroundColor = '#28a745';
            progressBar.appendChild(progressFill);

            overlay.appendChild(progressBar);
            document.body.appendChild(overlay);
        }
        document.getElementById('progress-message').innerText = message;
        document.getElementById('progress-fill').style.width = `${progress}%`;
    }

    // Hàm ẩn thanh tiến trình
    function hideProgressOverlay() {
        const overlay = document.getElementById('progress-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // Chạy script
    createSubtitleUI();
})();
