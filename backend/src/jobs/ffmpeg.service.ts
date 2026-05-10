import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AssetMetadata {
  durationMs: number;
  width: number;
  height: number;
  codec: string;
  audioCodec: string;
  audioChannels: number;
  fileSizeBytes: number;
}

@Injectable()
export class FfmpegService implements OnModuleInit {
  private readonly logger = new Logger(FfmpegService.name);
  private ffmpeg!: FFmpeg;
  private loaded = false;

  async onModuleInit() {
    this.ffmpeg = new FFmpeg();
    this.ffmpeg.on('log', ({ message }) => {
      this.logger.debug(`[ffmpeg] ${message}`);
    });
    try {
      await this.ffmpeg.load({
        coreURL: await toBlobURL(
          `https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js`,
          'text/javascript',
        ),
        wasmURL: await toBlobURL(
          `https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm`,
          'application/wasm',
        ),
      });
      this.loaded = true;
      this.logger.log('ffmpeg.wasm loaded successfully');
    } catch (err) {
      this.logger.warn(`ffmpeg.wasm failed to load (no network?): ${(err as Error).message}`);
    }
  }

  private async ensureLoaded() {
    if (!this.loaded) {
      throw new Error('ffmpeg.wasm is not loaded');
    }
  }

  async extractMetadata(inputUrl: string): Promise<AssetMetadata> {
    await this.ensureLoaded();
    this.logger.log(`Extracting metadata: ${inputUrl}`);

    const inputData = await fetchFile(inputUrl);
    await this.ffmpeg.writeFile('input_meta', inputData);

    const logs: string[] = [];
    const logHandler = ({ message }: { message: string }) => logs.push(message);
    this.ffmpeg.on('log', logHandler);

    try {
      await this.ffmpeg.exec(['-i', 'input_meta', '-f', 'null', '-']);
    } catch {
      // ffmpeg exits with code 1 when probing — logs still captured
    }

    this.ffmpeg.off('log', logHandler);
    await this.ffmpeg.deleteFile('input_meta');

    const combined = logs.join('\n');

    const durationMatch = combined.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    const videoMatch = combined.match(/Video:\s*(\w+).*?,\s*(\d+)x(\d+)/);
    const audioMatch = combined.match(/Audio:\s*(\w+).*?,\s*.*?(\d)\s*channel/);

    let durationMs = 0;
    if (durationMatch) {
      const [, hh, mm, ss] = durationMatch;
      durationMs = (parseInt(hh) * 3600 + parseInt(mm) * 60 + parseFloat(ss)) * 1000;
    }

    return {
      durationMs: Math.round(durationMs),
      width: videoMatch ? parseInt(videoMatch[2]) : 0,
      height: videoMatch ? parseInt(videoMatch[3]) : 0,
      codec: videoMatch ? videoMatch[1] : 'unknown',
      audioCodec: audioMatch ? audioMatch[1] : 'unknown',
      audioChannels: audioMatch ? parseInt(audioMatch[2]) : 0,
      fileSizeBytes: inputData.byteLength,
    };
  }

  async generateProxy(inputUrl: string, assetId: string): Promise<Uint8Array> {
    await this.ensureLoaded();
    this.logger.log(`Generating 720p proxy for asset: ${assetId}`);

    const inputData = await fetchFile(inputUrl);
    await this.ffmpeg.writeFile('proxy_input.mp4', inputData);

    await this.ffmpeg.exec([
      '-i', 'proxy_input.mp4',
      '-vf', 'scale=-2:720',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '128k',
      'proxy_output.mp4',
    ]);

    const output = await this.ffmpeg.readFile('proxy_output.mp4') as Uint8Array;
    await this.ffmpeg.deleteFile('proxy_input.mp4');
    await this.ffmpeg.deleteFile('proxy_output.mp4');

    this.logger.log(`Proxy generated: ${output.byteLength} bytes`);
    return output;
  }

  async generateThumbnails(inputUrl: string, assetId: string, intervalSeconds = 5): Promise<Uint8Array[]> {
    await this.ensureLoaded();
    this.logger.log(`Generating thumbnails every ${intervalSeconds}s for asset: ${assetId}`);

    const inputData = await fetchFile(inputUrl);
    await this.ffmpeg.writeFile('thumb_input.mp4', inputData);

    await this.ffmpeg.exec([
      '-i', 'thumb_input.mp4',
      '-vf', `fps=1/${intervalSeconds},scale=160:-1`,
      '-q:v', '5',
      'thumb_%03d.jpg',
    ]);

    const thumbnails: Uint8Array[] = [];
    let index = 1;
    while (true) {
      const name = `thumb_${String(index).padStart(3, '0')}.jpg`;
      try {
        const data = await this.ffmpeg.readFile(name) as Uint8Array;
        thumbnails.push(data);
        await this.ffmpeg.deleteFile(name);
        index++;
      } catch {
        break;
      }
    }

    await this.ffmpeg.deleteFile('thumb_input.mp4');
    this.logger.log(`Generated ${thumbnails.length} thumbnails`);
    return thumbnails;
  }

  async extractWaveform(inputUrl: string, assetId: string): Promise<{ peaks: number[][] }> {
    await this.ensureLoaded();
    this.logger.log(`Extracting waveform for asset: ${assetId}`);

    const inputData = await fetchFile(inputUrl);
    await this.ffmpeg.writeFile('wave_input.mp4', inputData);

    await this.ffmpeg.exec([
      '-i', 'wave_input.mp4',
      '-ac', '1',
      '-filter:a', 'aformat=sample_fmts=s16',
      '-f', 's16le',
      'wave_output.raw',
    ]);

    const rawData = await this.ffmpeg.readFile('wave_output.raw') as Uint8Array;
    await this.ffmpeg.deleteFile('wave_input.mp4');
    await this.ffmpeg.deleteFile('wave_output.raw');

    const samples = new Int16Array(rawData.buffer);
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
    await this.ensureLoaded();
    this.logger.log(`Trimming and concatenating ${segments.length} segments → ${outputPath}`);

    const segmentFiles: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segName = `seg_${i}.mp4`;
      const inputData = await fetchFile(seg.inputPath);
      await this.ffmpeg.writeFile(`raw_${i}.mp4`, inputData);

      await this.ffmpeg.exec([
        '-i', `raw_${i}.mp4`,
        '-ss', String(seg.inPointMs / 1000),
        '-to', String(seg.outPointMs / 1000),
        '-c', 'copy',
        segName,
      ]);

      await this.ffmpeg.deleteFile(`raw_${i}.mp4`);
      segmentFiles.push(segName);
    }

    const concatList = segmentFiles.map((f) => `file '${f}'`).join('\n');
    await this.ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatList));

    await this.ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat_list.txt',
      '-c', 'copy',
      'final_output.mp4',
    ]);

    const outputData = await this.ffmpeg.readFile('final_output.mp4') as Uint8Array;

    await this.ffmpeg.deleteFile('concat_list.txt');
    await this.ffmpeg.deleteFile('final_output.mp4');
    for (const f of segmentFiles) {
      await this.ffmpeg.deleteFile(f).catch(() => {});
    }

    const tmpDir = os.tmpdir();
    const outFile = path.join(tmpDir, path.basename(outputPath));
    fs.writeFileSync(outFile, outputData);

    this.logger.log(`Concat done: ${outFile} (${outputData.byteLength} bytes)`);
    return outFile;
  }

  async applyEffects(
    inputPath: string,
    outputPath: string,
    effects: Array<{ type: string; params: Record<string, any> }>,
  ): Promise<string> {
    await this.ensureLoaded();
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

    const inputData = fs.readFileSync(inputPath);
    await this.ffmpeg.writeFile('fx_input.mp4', new Uint8Array(inputData));

    await this.ffmpeg.exec([
      '-i', 'fx_input.mp4',
      '-vf', filterParts.join(','),
      '-c:a', 'copy',
      'fx_output.mp4',
    ]);

    const outputData = await this.ffmpeg.readFile('fx_output.mp4') as Uint8Array;
    await this.ffmpeg.deleteFile('fx_input.mp4');
    await this.ffmpeg.deleteFile('fx_output.mp4');

    fs.writeFileSync(outputPath, outputData);
    this.logger.log(`Effects applied → ${outputPath}`);
    return outputPath;
  }

  async overlayTracks(inputPaths: string[], outputPath: string): Promise<string> {
    await this.ensureLoaded();
    this.logger.log(`Overlaying ${inputPaths.length} tracks`);

    for (let i = 0; i < inputPaths.length; i++) {
      const data = fs.readFileSync(inputPaths[i]);
      await this.ffmpeg.writeFile(`overlay_${i}.mp4`, new Uint8Array(data));
    }

    let filterComplex = `[0:v]setpts=PTS-STARTPTS[base];`;
    for (let i = 1; i < inputPaths.length; i++) {
      filterComplex += `[${i}:v]setpts=PTS-STARTPTS,format=yuva420p[ov${i}];`;
      filterComplex += `[base][ov${i}]overlay=0:0:format=auto[base];`;
    }
    filterComplex = filterComplex.replace(/\[base\];$/, '[outv]');

    const inputs = inputPaths.flatMap((_, i) => ['-i', `overlay_${i}.mp4`]);
    await this.ffmpeg.exec([
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      'overlay_output.mp4',
    ]);

    const outputData = await this.ffmpeg.readFile('overlay_output.mp4') as Uint8Array;
    for (let i = 0; i < inputPaths.length; i++) {
      await this.ffmpeg.deleteFile(`overlay_${i}.mp4`).catch(() => {});
    }
    await this.ffmpeg.deleteFile('overlay_output.mp4').catch(() => {});

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
    await this.ensureLoaded();
    this.logger.log(`Burning ${overlays.length} text overlays`);

    if (overlays.length === 0) return inputPath;

    const inputData = fs.readFileSync(inputPath);
    await this.ffmpeg.writeFile('text_input.mp4', new Uint8Array(inputData));

    const drawtexts = overlays.map((o, i) => {
      const x = Math.round(o.positionX * 100);
      const y = Math.round(o.positionY * 100);
      const start = o.trackPositionMs / 1000;
      const end = (o.trackPositionMs + o.durationMs) / 1000;
      return `drawtext=text='${o.content}':fontsize=${o.fontSize}:fontcolor=${o.fontColor}:x=(w*${x}/100):y=(h*${y}/100):enable='between(t\\,${start}\\,${end})'`;
    });

    await this.ffmpeg.exec([
      '-i', 'text_input.mp4',
      '-vf', drawtexts.join(','),
      '-c:a', 'copy',
      'text_output.mp4',
    ]);

    const outputData = await this.ffmpeg.readFile('text_output.mp4') as Uint8Array;
    await this.ffmpeg.deleteFile('text_input.mp4');
    await this.ffmpeg.deleteFile('text_output.mp4');

    fs.writeFileSync(outputPath, outputData);
    this.logger.log(`Text overlays burned → ${outputPath}`);
    return outputPath;
  }
}
