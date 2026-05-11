import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ffmpegPath from 'ffmpeg-static';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const FFMPEG_BINARY: string = (ffmpegPath as unknown as string) || 'ffmpeg';
if (FFMPEG_BINARY) {
  ffmpeg.setFfmpegPath(FFMPEG_BINARY);
}

export interface AssetMetadata {
  durationMs: number;
  width: number;
  height: number;
  codec: string;
  audioCodec: string;
  audioChannels: number;
  fileSizeBytes: number;
}

function runFfmpeg(cmd: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    cmd
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });
}

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  private tmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cloudcut-'));
  }

  async extractMetadata(inputUrl: string): Promise<AssetMetadata> {
    this.logger.log(`Extracting metadata: ${inputUrl}`);
    const stats = fs.existsSync(inputUrl) ? fs.statSync(inputUrl) : { size: 0 };

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputUrl, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
        const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');
        const durationSec = parseFloat(String(data.format.duration || '0'));
        resolve({
          durationMs: Math.round(durationSec * 1000),
          width: videoStream?.width ?? 0,
          height: videoStream?.height ?? 0,
          codec: videoStream?.codec_name ?? 'unknown',
          audioCodec: audioStream?.codec_name ?? 'unknown',
          audioChannels: audioStream?.channels ?? 0,
          fileSizeBytes: stats.size,
        });
      });
    });
  }

  async generateProxy(inputUrl: string, assetId: string): Promise<Uint8Array> {
    this.logger.log(`Generating 720p proxy for asset: ${assetId}`);
    const tmp = this.tmpDir();
    const outFile = path.join(tmp, 'proxy.mp4');

    await runFfmpeg(
      ffmpeg(inputUrl)
        .videoFilter('scale=-2:720')
        .videoCodec('libx264')
        .addOption('-preset', 'fast')
        .addOption('-crf', '28')
        .audioCodec('aac')
        .audioBitrate('128k')
        .output(outFile),
    );

    const output = fs.readFileSync(outFile);
    fs.rmSync(tmp, { recursive: true, force: true });
    this.logger.log(`Proxy generated: ${output.byteLength} bytes`);
    return new Uint8Array(output);
  }

  async generateThumbnails(inputUrl: string, assetId: string, intervalSeconds = 5): Promise<Uint8Array[]> {
    this.logger.log(`Generating thumbnails every ${intervalSeconds}s for asset: ${assetId}`);
    const tmp = this.tmpDir();

    await runFfmpeg(
      ffmpeg(inputUrl)
        .videoFilter(`fps=1/${intervalSeconds},scale=160:-1`)
        .addOption('-q:v', '5')
        .output(path.join(tmp, 'thumb_%03d.jpg')),
    );

    const files = fs.readdirSync(tmp).filter((f) => f.startsWith('thumb_')).sort();
    const thumbnails = files.map((f) => new Uint8Array(fs.readFileSync(path.join(tmp, f))));
    fs.rmSync(tmp, { recursive: true, force: true });
    this.logger.log(`Generated ${thumbnails.length} thumbnails`);
    return thumbnails;
  }

  async extractWaveform(inputUrl: string, assetId: string): Promise<{ peaks: number[][] }> {
    this.logger.log(`Extracting waveform for asset: ${assetId}`);
    const tmp = this.tmpDir();
    const rawFile = path.join(tmp, 'wave.raw');

    await runFfmpeg(
      ffmpeg(inputUrl)
        .audioChannels(1)
        .audioFilter('aformat=sample_fmts=s16')
        .format('s16le')
        .output(rawFile),
    );

    const rawData = fs.readFileSync(rawFile);
    fs.rmSync(tmp, { recursive: true, force: true });

    const samples = new Int16Array(rawData.buffer, rawData.byteOffset, rawData.byteLength / 2);
    const bucketCount = 200;
    const bucketSize = Math.floor(samples.length / bucketCount);
    const peaks: number[][] = [];

    for (let i = 0; i < bucketCount; i++) {
      let min = 0;
      let max = 0;
      for (let j = 0; j < bucketSize; j++) {
        const val = samples[i * bucketSize + j] / 32768;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      peaks.push([min, max]);
    }

    this.logger.log(`Waveform extracted: ${peaks.length} buckets`);
    return { peaks };
  }

  async trimAndConcat(
    segments: Array<{ inputPath: string; inPointMs: number; outPointMs: number }>,
    outputPath: string,
  ): Promise<string> {
    this.logger.log(`Trimming and concatenating ${segments.length} segments → ${outputPath}`);
    const tmp = this.tmpDir();
    const segmentFiles: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segFile = path.join(tmp, `seg_${i}.mp4`);
      await runFfmpeg(
        ffmpeg(seg.inputPath)
          .seekInput(seg.inPointMs / 1000)
          .duration((seg.outPointMs - seg.inPointMs) / 1000)
          .addOption('-c', 'copy')
          .output(segFile),
      );
      segmentFiles.push(segFile);
    }

    const listFile = path.join(tmp, 'concat_list.txt');
    const concatList = segmentFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFile, concatList);

    const outFile = path.join(tmp, 'final_output.mp4');
    await runFfmpeg(
      ffmpeg()
        .input(listFile)
        .inputFormat('concat')
        .addOption('-safe', '0')
        .addOption('-c', 'copy')
        .output(outFile),
    );

    const outputData = fs.readFileSync(outFile);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, outputData);
    fs.rmSync(tmp, { recursive: true, force: true });

    this.logger.log(`Concat done: ${outputPath} (${outputData.byteLength} bytes)`);
    return outputPath;
  }

  async applyEffects(
    inputPath: string,
    outputPath: string,
    effects: Array<{ type: string; params: Record<string, any> }>,
  ): Promise<string> {
    this.logger.log(`Applying ${effects.length} effects`);

    const filterParts: string[] = [];
    for (const effect of effects) {
      switch (effect.type) {
        case 'brightness':
          filterParts.push(`eq=brightness=${(effect.params.value || 0) / 100}`);
          break;
        case 'contrast':
          filterParts.push(`eq=contrast=${effect.params.value || 1}`);
          break;
        case 'saturation':
          filterParts.push(`eq=saturation=${effect.params.value || 1}`);
          break;
        case 'blur':
          filterParts.push(`boxblur=${Math.max(1, effect.params.value || 1)}`);
          break;
        case 'grayscale':
          filterParts.push('colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3');
          break;
      }
    }

    if (filterParts.length === 0) return outputPath;

    await runFfmpeg(
      ffmpeg(inputPath)
        .videoFilter(filterParts.join(','))
        .audioCodec('copy')
        .output(outputPath),
    );

    this.logger.log(`Effects applied → ${outputPath}`);
    return outputPath;
  }

  async overlayTracks(inputPaths: string[], outputPath: string): Promise<string> {
    this.logger.log(`Overlaying ${inputPaths.length} tracks`);
    const tmp = this.tmpDir();
    const outFile = path.join(tmp, 'overlay.mp4');

    let filterComplex = '[0:v]setpts=PTS-STARTPTS[base];';
    for (let i = 1; i < inputPaths.length; i++) {
      filterComplex += `[${i}:v]setpts=PTS-STARTPTS,format=yuva420p[ov${i}];`;
      filterComplex += `[base][ov${i}]overlay=0:0:format=auto[base];`;
    }
    filterComplex = filterComplex.replace(/\[base\];$/, '[outv]');

    const cmd = ffmpeg();
    for (const input of inputPaths) {
      cmd.input(input);
    }
    await runFfmpeg(
      cmd
        .complexFilter(filterComplex)
        .addOption('-map', '[outv]')
        .addOption('-map', '0:a?')
        .videoCodec('libx264')
        .audioCodec('aac')
        .output(outFile),
    );

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(outFile, outputPath);
    fs.rmSync(tmp, { recursive: true, force: true });

    this.logger.log(`Overlay done → ${outputPath}`);
    return outputPath;
  }

  async burnTextOverlays(
    inputPath: string,
    outputPath: string,
    overlays: Array<{
      content: string;
      positionX: number;
      positionY: number;
      fontSize: number;
      fontColor: string;
      durationMs: number;
      trackPositionMs: number;
    }>,
  ): Promise<string> {
    this.logger.log(`Burning ${overlays.length} text overlays`);

    if (overlays.length === 0) return inputPath;

    const drawtexts = overlays.map((o) => {
      const x = Math.round(o.positionX * 100);
      const y = Math.round(o.positionY * 100);
      const start = o.trackPositionMs / 1000;
      const end = (o.trackPositionMs + o.durationMs) / 1000;
      return `drawtext=text='${o.content}':fontsize=${o.fontSize}:fontcolor=${o.fontColor}:x=(w*${x}/100):y=(h*${y}/100):enable='between(t\\,${start}\\,${end})'`;
    });

    await runFfmpeg(
      ffmpeg(inputPath)
        .videoFilter(drawtexts.join(','))
        .audioCodec('copy')
        .output(outputPath),
    );

    this.logger.log(`Text overlays burned → ${outputPath}`);
    return outputPath;
  }
}
