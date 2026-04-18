// recorder.js
// Handles continuous MP4 segment recording per feed and alert clip flushing.
//
// Directory structure:
//   recordings/
//     <session_name>/          ← set when FeedRecorder is created
//       Seat_01/
//         Seat_01_seg_0000_2026-04-12_09-30-00.mp4
//         Seat_01_alert_2026-04-12_09-35-22.mp4
//
// session_name comes from the active exam_sessions row passed in from wsHandler.
// If no session is active, falls back to a timestamp folder (safe default).

import 'dotenv/config';
import { spawn }               from 'child_process';
import { mkdirSync, statSync } from 'fs';
import path                    from 'path';
import { query }               from './db.js';

const VIDEO_DIR        = process.env.VIDEO_DIR || './recordings';
const SEGMENT_DURATION = 10 * 60 * 1000; // 10 minutes
const FFMPEG_FPS       = 10;

// ── Helpers ───────────────────────────────────────────────────

function formatTs(d) {
  const pad = n => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

function sanitise(label) {
  return label.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

function writeFramesToMp4(frames, outPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-f',         'mjpeg',
      '-framerate', String(FFMPEG_FPS),
      '-i',         'pipe:0',
      '-c:v',       'libx264',
      '-preset',    'fast',
      '-crf',       '26',
      '-pix_fmt',   'yuv420p',
      '-y',
      outPath
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    ff.stderr.on('data', chunk => {
      const line = chunk.toString();
      if (/error|invalid/i.test(line))
        console.error('[Recorder] ffmpeg (one-shot):', line.trim());
    });

    ff.on('error', reject);
    ff.on('exit', code => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });

    for (const buf of frames) {
      try { ff.stdin.write(buf); } catch (_) {}
    }
    try { ff.stdin.end(); } catch (_) {}
  });
}

// ── FeedRecorder ──────────────────────────────────────────────

export class FeedRecorder {
  /**
   * @param {number} feedId
   * @param {string} label        - human label e.g. "Seat 01"
   * @param {string} sessionName  - active session name (filesystem-safe)
   *                                pass '' or null to fallback to timestamp
   * @param {number|null} sessionId - DB session id for video_segments insert
   */
  constructor(feedId, label, sessionName = null, sessionId = null) {
    this.feedId    = feedId;
    this.label     = label;
    this.labelSafe = sanitise(label);
    this.sessionId = sessionId;

    // Use session name as folder, fallback to timestamp if none active
    const folder   = sessionName ? sanitise(sessionName) : formatTs(new Date());
    this.dir       = path.join(VIDEO_DIR, folder, this.labelSafe);
    mkdirSync(this.dir, { recursive: true });

    this.ffmpeg      = null;
    this.segmentId   = null;
    this.segmentPath = null;
    this.segmentIdx  = 0;
    this.timer       = null;
    this.running     = false;

    console.log(`[Recorder] Feed ${feedId} ("${label}") → ${this.dir}`);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._openSegment();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    this._closeSegment();
  }

  writeFrame(jpegBuffer) {
    if (!this.ffmpeg?.stdin?.writable) return;
    try { this.ffmpeg.stdin.write(jpegBuffer); }
    catch (err) { console.error(`[Recorder] Write error (feed ${this.feedId}):`, err.message); }
  }

  getCurrentSegmentId() { return this.segmentId; }

  async flushAlertClip(frames, detectionId) {
    if (!frames || frames.length === 0) return null;

    const ts        = formatTs(new Date());
    const alertPath = path.join(this.dir, `${this.labelSafe}_alert_${ts}.mp4`);

    console.log(`[Recorder] Flushing ${frames.length} frames → ${alertPath}`);

    try {
      await writeFramesToMp4(frames, alertPath);

      await query(
        'UPDATE detections SET alert_clip_path = $1 WHERE id = $2',
        [alertPath, detectionId]
      );

      return alertPath;
    } catch (err) {
      console.error(`[Recorder] flushAlertClip error (feed ${this.feedId}):`, err.message);
      return null;
    }
  }

  _openSegment() {
    const ts = formatTs(new Date());
    this.segmentPath = path.join(
      this.dir,
      `${this.labelSafe}_seg_${String(this.segmentIdx).padStart(4,'0')}_${ts}.mp4`
    );

    this.ffmpeg = spawn('ffmpeg', [
      '-f',         'mjpeg',
      '-framerate', String(FFMPEG_FPS),
      '-i',         'pipe:0',
      '-c:v',       'libx264',
      '-preset',    'fast',
      '-crf',       '26',
      '-pix_fmt',   'yuv420p',
      '-y',
      this.segmentPath
    ], { stdio: ['pipe', 'ignore', 'pipe'] });

    this.ffmpeg.stderr.on('data', chunk => {
      const line = chunk.toString();
      if (/error|invalid/i.test(line))
        console.error(`[Recorder] ffmpeg (feed ${this.feedId}):`, line.trim());
    });

    this.ffmpeg.on('error', err => {
      console.error(`[Recorder] Spawn error (feed ${this.feedId}):`, err.message);
    });

    this.ffmpeg.on('exit', code => {
      if (code !== 0 && code !== null)
        console.error(`[Recorder] ffmpeg exit code ${code} (feed ${this.feedId})`);
    });

    // Insert video_segments DB row — include session_id if available
    query(
      `INSERT INTO video_segments (session_id, feed_id, file_path, started_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [this.sessionId, this.feedId, this.segmentPath]
    ).then(result => {
      this.segmentId = result.rows[0].id;
      console.log(`[Recorder] Segment ${this.segmentIdx} opened (feed ${this.feedId})`);
      this.segmentIdx++;
    }).catch(err => {
      console.error('[Recorder] DB segment insert error:', err.message);
    });

    this.timer = setTimeout(() => {
      if (this.running) this._rotateSegment();
    }, SEGMENT_DURATION);
  }

  _rotateSegment() {
    this._closeSegment();
    this._openSegment();
  }

  _closeSegment() {
    if (this.ffmpeg) {
      try { this.ffmpeg.stdin.end(); } catch (_) {}
      this.ffmpeg = null;
    }

    if (this.segmentId !== null) {
      let size = 0;
      try { size = statSync(this.segmentPath).size; } catch (_) {}

      query(
        `UPDATE video_segments SET ended_at = NOW(), size_bytes = $1 WHERE id = $2`,
        [size, this.segmentId]
      ).catch(err => {
        console.error('[Recorder] DB close segment error:', err.message);
      });

      this.segmentId   = null;
      this.segmentPath = null;
    }
  }
}