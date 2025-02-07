const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const express = require('express');
const ytdlp = require('yt-dlp-exec');
const fs = require('fs');
const path = require('path');


const app = express();
const port = 3000;


// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to render the HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function mergeVideoAudio(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .input(audioPath)
      .output(outputPath)
      .outputOptions('-c:v copy')
      .on('start', (command) => {
        console.log('FFmpeg command:', command);
      })
      .on('end', () => {
        console.log('Merging complete.');
        resolve();
      })
      .on('error', (err) => {
        console.error('FFmpeg Error:', err.message);
        reject(err);
      })
      .run(); // Use run() instead of save() for correct FFmpeg execution
  });
}


app.get('/download', async (req, res) => {
  const videoURL = req.query.url;

  if (!videoURL) {
    return res.status(400).send('Please provide a valid YouTube URL');
  }

  const videoTempDir = path.join(__dirname, 'temp');
  const videoFilePath = path.join(videoTempDir, `${Date.now()}_video.mp4`);
  const audioFilePath = path.join(videoTempDir, `${Date.now()}_audio.mp4`);
  const mergedFilePath = path.join(__dirname, `${Date.now()}_merged_video.mp4`);

  try {
    console.log('Starting download for video URL:', videoURL);

    // Ensure the temp directory exists
    if (!fs.existsSync(videoTempDir)) {
      fs.mkdirSync(videoTempDir);
    }

    // Download the best video
    await ytdlp(videoURL, {
      output: videoFilePath,
      format: 'bestvideo',
    });

    // Download the best audio
    await ytdlp(videoURL, {
      output: audioFilePath,
      format: 'bestaudio',
    });

    console.log('Video and audio download complete. Merging...');

    // Merge the video and audio
    await mergeVideoAudio(videoFilePath, audioFilePath, mergedFilePath);

    // Send the merged file
    res.download(mergedFilePath, 'youtube_video.mp4', (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Failed to send the video');
      }

      // Clean up temporary files after sending
      fs.unlinkSync(videoFilePath);
      fs.unlinkSync(audioFilePath);
      fs.unlinkSync(mergedFilePath);
    });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send('Failed to download or merge the video.');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
