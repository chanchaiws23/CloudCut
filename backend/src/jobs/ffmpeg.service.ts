import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AssetMetadata {
  durationMs: number;
  width: number;
  height: number;
  codec: string;
  audioCodec: string;
  audioChannels: number;
  fileSizeBytes: number;
}

interface FfmpegLog {
  message: string;
  type: string;
}

type FFmpegType = InstanceType<typeof import('@ffmpeg/ffmpeg').FFmpeg>;

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);
  private ffmpeg: FFmpegType | null = null;

  private async getFfmpeg(): Promise<FFmpegType> {
    if (!this.ffmpeg) {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      this.ffmpeg = new FFmpeg();
      this.ffmpeg.on('log', ({ message }: FfmpegLog) => {
        this.logger.debug(message);
      });
      await this.ffmpeg.load();
    }
    return this.ffmpeg;
  }

  private async fetchInput(inputUrl: string): Promise<{ name: string; data: Uint8Array }> {
    if (inputUrl.startsWith('http://') || inputUrl.startsWith('https://')) {
      const res = await fetch(inputUrl);
      const buffer = await res.arrayBuffer();
      const name = path.basename(new URL(inputUrl).pathname) || 'input.mp4';
      return { name, data: new Uint8Array(buffer) };
    }
    const data = fs.readFileSync(inputUrl);
    return { name: path.basename(inputUrl), data: new Uint8Array(data) };
  }

  private async runCommand(
    args: string[],
    inputs: { name: string; data: Uint8Array }[],
    outputs: string[],
  ): Promise<{ exitCode: number; logs: string[] }> {
    const ffmpeg = await this.getFfmpeg();
    const logs: string[] = [];

    ffmpeg.on('log', ({ message }: FfmpegLog) => {
      logs.push(message);
    });

    for (const input of inputs) {
      await ffmpeg.writeFile(input.name, input.data);
    }

    const exitCode = await ffmpeg.exec(args);

    for (const input of inputs) {
      try {
        await ffmpeg.deleteFile(input.name);
      } catch {
        /* ignore */ }
    }

    return { exitCode, logs };
  }

  async extractMetadata(inputUrl: string): Promise<AssetMetadata> {
    this.logger.log(`Extracting metadata: ${inputUrl}`);
    const { name, data } = await this.fetchInput(inputUrl);
    const { exitCode, logs } = await this.runCommand(['-i', name], [{ name, data }], []);

    const logText = logs.join('\n');

    const durationMatch = logText.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    let durationMs = 0;
    if (durationMatch) {
      const hours = parseInt(durationMatch[1], 10);
      const minutes = parseInt(durationMatch[2], 10);
      const seconds = parseFloat(durationMatch[3]);
      durationMs = Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
    }

    const videoMatch = logText.match(/Stream\s+#.*Video:\s*(\w+)[^,]*,\s*[^,]*,\s*(\d+)x(\d+)/);
    const audioMatch = logText.match(/Stream\s+#.*Audio:\s*(\w+)/);
    const channelsMatch = logText.match(/Stream\s+#.*Audio:.*\s+(\d+)\s+channels/);

    return {
      durationMs,
      width: videoMatch ? parseInt(videoMatch[2], 10) : 0,
      height: videoMatch ? parseInt(videoMatch[3], 10) : 0,
      codec: videoMatch ? videoMatch[1] : 'unknown',
      audioCodec: audioMatch ? audioMatch[1] : 'unknown',
      audioChannels: channelsMatch ? parseInt(channelsMatch[1], 10) : (audioMatch ? 2 : 0),
      fileSizeBytes: data.byteLength,
    };
  }

  async generateProxy(inputUrl: string, assetId: string): Promise<Uint8Array> {
    this.logger.log(`Generating 720p proxy for asset: ${assetId}`);
    const { name, data } = await this.fetchInput(inputUrl);
    const outputName = 'proxy.mp4';

    const { exitCode } = await this.runCommand(
      [
        '-i', name,
        '-vf', 'scale=-2:720',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputName,
      ],
      [{ name, data }],
      [outputName],
    );

    if (exitCode !== 0) {
      throw new Error(`Proxy generation failed with exit code ${exitCode}`);
    }

    const output = await (await this.getFfmpeg()).readFile(outputName);
    await (await this.getFfmpeg()).deleteFile(outputName);
    this.logger.log(`Proxy generated: ${(output as Uint8Array).byteLength} bytes`);
    return output as Uint8Array;
  }

  async generateThumbnails(inputUrl: string, assetId: string, intervalSeconds = 5): Promise<Uint8Array[]> {
    this.logger.log(`Generating thumbnails every ${intervalSeconds}s for asset: ${assetId}`);
    const { name, data } = await this.fetchInput(inputUrl);
    const pattern = 'thumb_%03d.jpg';

    const { exitCode } = await this.runCommand(
      [
        '-i', name,
        '-vf', `fps=1/${intervalSeconds},scale=160:-1`,
        '-q:v', '5',
        pattern,
      ],
      [{ name, data }],
      [],
    );

    if (exitCode !== 0) {
      throw new Error(`Thumbnail generation failed with exit code ${exitCode}`);
    }

    const ffmpeg = await this.getFfmpeg();
    const thumbnails: Uint8Array[] = [];
    for (let i = 1; i <= 999; i++) {
      const fileName = `thumb_${String(i).padStart(3, '0')}.jpg`;
      try {
        const thumb = await ffmpeg.readFile(fileName);
        thumbnails.push(thumb as Uint8Array);
        await ffmpeg.deleteFile(fileName);
      } catch {
        break;
      }
    }

    this.logger.log(`Generated ${thumbnails.length} thumbnails`);
    return thumbnails;
  }

  async extractWaveform(inputUrl: string, assetId: string): Promise<{ peaks: number[][] }> {
    this.logger.log(`Extracting waveform for asset: ${assetId}`);
    const { name, data } = await this.fetchInput(inputUrl);
    const rawName = 'wave.raw';

    const { exitCode } = await this.runCommand(
      [
        '-i', name,
        '-ac', '1',
        '-af', 'aformat=sample_fmts=s16',
        '-f', 's16le',
        rawName,
      ],
      [{ name, data }],
      [rawName],
    );

    if (exitCode !== 0) {
      throw new Error(`Waveform extraction failed with exit code ${exitCode}`);
    }

    const ffmpeg = await this.getFfmpeg();
    const rawData = await ffmpeg.readFile(rawName);
    await ffmpeg.deleteFile(rawName);

    const buffer = rawData as Uint8Array;
    const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
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
    const ffmpeg = await this.getFfmpeg();
    const segmentNames: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const { name, data } = await this.fetchInput(seg.inputPath);
      await ffmpeg.writeFile(name, data);
      const segName = `seg_${i}.mp4`;
      const exitCode = await ffmpeg.exec([
        '-i', name,
        '-ss', `${seg.inPointMs / 1000}`,
        '-t', `${(seg.outPointMs - seg.inPointMs) / 1000}`,
        '-c', 'copy',
        segName,
      ]);
      await ffmpeg.deleteFile(name);
      if (exitCode !== 0) {
        throw new Error(`Trim segment ${i} failed with exit code ${exitCode}`);
      }
      segmentNames.push(segName);
    }

    const listName = 'concat_list.txt';
    const concatList = segmentNames.map((n) => `file '${n}'`).join('\n');
    await ffmpeg.writeFile(listName, new TextEncoder().encode(concatList));

    const outName = 'final_output.mp4';
    const concatExit = await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', listName,
      '-c', 'copy',
      outName,
    ]);

    await ffmpeg.deleteFile(listName);

    if (concatExit !== 0) {
      throw new Error(`Concatenation failed with exit code ${concatExit}`);
    }

    const outputData = await ffmpeg.readFile(outName);
    await ffmpeg.deleteFile(outName);
    for (const segName of segmentNames) {
      try { await ffmpeg.deleteFile(segName); } catch { /* ignore */ }
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, outputData);

    this.logger.log(`Concat done: ${outputPath} (${(outputData as Uint8Array).byteLength} bytes)`);
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

    if (filterParts.length === 0) {
      const { name, data } = await this.fetchInput(inputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, data);
      return outputPath;
    }

    const { name, data } = await this.fetchInput(inputPath);
    const outName = 'effect_output.mp4';
    const { exitCode } = await this.runCommand(
      [
        '-i', name,
        '-vf', filterParts.join(','),
        '-c:a', 'copy',
        outName,
      ],
      [{ name, data }],
      [outName],
    );

    if (exitCode !== 0) {
      throw new Error(`Effect application failed with exit code ${exitCode}`);
    }

    const ffmpeg = await this.getFfmpeg();
    const outputData = await ffmpeg.readFile(outName);
    await ffmpeg.deleteFile(outName);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, outputData);

    this.logger.log(`Effects applied → ${outputPath}`);
    return outputPath;
  }

  async overlayTracks(inputPaths: string[], outputPath: string): Promise<string> {
    this.logger.log(`Overlaying ${inputPaths.length} tracks`);
    const ffmpeg = await this.getFfmpeg();
    const inputs: { name: string; data: Uint8Array }[] = [];

    for (let i = 0; i < inputPaths.length; i++) {
      const fetched = await this.fetchInput(inputPaths[i]);
      inputs.push(fetched);
      await ffmpeg.writeFile(fetched.name, fetched.data);
    }

    let filterComplex = '[0:v]setpts=PTS-STARTPTS[base];';
    for (let i = 1; i < inputPaths.length; i++) {
      filterComplex += `[${i}:v]setpts=PTS-STARTPTS,format=yuva420p[ov${i}];`;
      filterComplex += `[base][ov${i}]overlay=0:0:format=auto[base];`;
    }
    filterComplex = filterComplex.replace(/\[base\];$/, '[outv]');

    const outName = 'overlay.mp4';
    const args = [];
    for (let i = 0; i < inputs.length; i++) {
      args.push('-i', inputs[i].name);
    }
    args.push(
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      outName,
    );

    const exitCode = await ffmpeg.exec(args);

    for (const input of inputs) {
      try { await ffmpeg.deleteFile(input.name); } catch { /* ignore */ }
    }

    if (exitCode !== 0) {
      throw new Error(`Overlay failed with exit code ${exitCode}`);
    }

    const outputData = await ffmpeg.readFile(outName);
    await ffmpeg.deleteFile(outName);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, outputData);

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

    if (overlays.length === 0) {
      const { data } = await this.fetchInput(inputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, data);
      return outputPath;
    }

    const drawtexts = overlays.map((o) => {
      const x = Math.round(o.positionX * 100);
      const y = Math.round(o.positionY * 100);
      const start = o.trackPositionMs / 1000;
      const end = (o.trackPositionMs + o.durationMs) / 1000;
      return `drawtext=text='${o.content}':fontsize=${o.fontSize}:fontcolor=${o.fontColor}:x=(w*${x}/100):y=(h*${y}/100):enable='between(t\\,${start}\\,${end})'`;
    });

    const { name, data } = await this.fetchInput(inputPath);
    const outName = 'text_output.mp4';
    const { exitCode } = await this.runCommand(
      [
        '-i', name,
        '-vf', drawtexts.join(','),
        '-c:a', 'copy',
        outName,
      ],
      [{ name, data }],
      [outName],
    );

    if (exitCode !== 0) {
      throw new Error(`Text overlay burn failed with exit code ${exitCode}`);
    }

    const ffmpeg = await this.getFfmpeg();
    const outputData = await ffmpeg.readFile(outName);
    await ffmpeg.deleteFile(outName);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, outputData);

    this.logger.log(`Text overlays burned → ${outputPath}`);
    return outputPath;
  }
}
