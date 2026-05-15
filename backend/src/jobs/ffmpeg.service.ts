import { Injectable, Logger } from '@nestjs/common';
import { FFmpeg } from '@ffmpeg/ffmpeg';
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
  private wasm?: FFmpeg;
  private wasmAvailable = process.env.FFMPEG_ENGINE !== 'native';

  private tmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cloudcut-'));
  }

  private resolveInput(inputUrl: string): string {
    if (inputUrl.startsWith('/uploads/')) {
      return path.join(process.cwd(), inputUrl.slice(1));
    }
    return inputUrl;
  }

  private async getWasm(): Promise<FFmpeg | null> {
    if (!this.wasmAvailable) return null;
    if (this.wasm?.loaded) return this.wasm;
    try {
      this.wasm = new FFmpeg();
      this.wasm.on('log', ({ message }) => this.logger.debug(`[ffmpeg.wasm] ${message}`));
      await this.wasm.load();
      return this.wasm;
    } catch (error) {
      this.wasmAvailable = false;
      this.logger.warn(`ffmpeg.wasm unavailable, falling back to native ffmpeg: ${(error as Error).message}`);
      return null;
    }
  }

  private async writeWasmInput(wasm: FFmpeg, inputUrl: string, name = 'input'): Promise<string> {
    const input = this.resolveInput(inputUrl);
    const ext = path.extname(input).split('?')[0] || '.mp4';
    const inputName = `${name}${ext}`;
    let data: Uint8Array;
    if (input.startsWith('http')) {
      const response = await fetch(input);
      const buffer = await response.arrayBuffer();
      data = new Uint8Array(buffer as ArrayBuffer);
    } else {
      data = new Uint8Array(fs.readFileSync(input));
    }
    await wasm.writeFile(inputName, data);
    return inputName;
  }

  private async tryWasmRead(fileName: string): Promise<Uint8Array | null> {
    const wasm = await this.getWasm();
    if (!wasm) return null;
    const output = await wasm.readFile(fileName);
    if (typeof output === 'string') return new TextEncoder().encode(output);
    return output;
  }

  async extractMetadata(inputUrl: string): Promise<AssetMetadata> {
    const input = this.resolveInput(inputUrl);
    this.logger.log(`Extracting metadata: ${input}`);
    const stats = fs.existsSync(input) ? fs.statSync(input) : { size: 0 };

    const wasm = await this.getWasm();
    if (wasm) {
      try {
        const inputName = await this.writeWasmInput(wasm, inputUrl);
        await wasm.ffprobe([
          '-v', 'error',
          '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,channels',
          '-of', 'json',
          inputName,
          '-o', 'metadata.json',
        ]);
        const raw = await wasm.readFile('metadata.json', 'utf8');
        const data = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
        const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
        const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio');
        await wasm.deleteFile(inputName).catch(() => undefined);
        await wasm.deleteFile('metadata.json').catch(() => undefined);
        return {
          durationMs: Math.round(parseFloat(String(data.format?.duration || '0')) * 1000),
          width: videoStream?.width ?? 0,
          height: videoStream?.height ?? 0,
          codec: videoStream?.codec_name ?? 'unknown',
          audioCodec: audioStream?.codec_name ?? 'unknown',
          audioChannels: audioStream?.channels ?? 0,
          fileSizeBytes: stats.size,
        };
      } catch (error) {
        this.logger.warn(`ffmpeg.wasm metadata failed, using native ffprobe: ${(error as Error).message}`);
      }
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(input, (err, data) => {
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
    const wasm = await this.getWasm();
    if (wasm) {
      try {
        const inputName = await this.writeWasmInput(wasm, inputUrl);
        const outName = 'proxy.mp4';
        await wasm.exec(['-i', inputName, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'fast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', outName]);
        const output = await this.tryWasmRead(outName);
        await wasm.deleteFile(inputName).catch(() => undefined);
        await wasm.deleteFile(outName).catch(() => undefined);
        if (output) return output;
      } catch (error) {
        this.logger.warn(`ffmpeg.wasm proxy failed, using native ffmpeg: ${(error as Error).message}`);
      }
    }
    const input = this.resolveInput(inputUrl);
    const tmp = this.tmpDir();
    const outFile = path.join(tmp, 'proxy.mp4');

    await runFfmpeg(
      ffmpeg(input)
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
    const wasm = await this.getWasm();
    if (wasm) {
      try {
        const inputName = await this.writeWasmInput(wasm, inputUrl);
        await wasm.exec(['-i', inputName, '-vf', `fps=1/${intervalSeconds},scale=160:-1`, '-q:v', '5', 'thumb_%03d.jpg']);
        const files = await wasm.listDir('.');
        const thumbNames = files.map((f) => f.name).filter((name) => name.startsWith('thumb_')).sort();
        const thumbnails: Uint8Array[] = [];
        for (const name of thumbNames) {
          const data = await wasm.readFile(name);
          thumbnails.push(typeof data === 'string' ? new TextEncoder().encode(data) : data);
          await wasm.deleteFile(name).catch(() => undefined);
        }
        await wasm.deleteFile(inputName).catch(() => undefined);
        if (thumbnails.length > 0) return thumbnails;
      } catch (error) {
        this.logger.warn(`ffmpeg.wasm thumbnails failed, using native ffmpeg: ${(error as Error).message}`);
      }
    }
    const input = this.resolveInput(inputUrl);
    const tmp = this.tmpDir();

    await runFfmpeg(
      ffmpeg(input)
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
    const input = this.resolveInput(inputUrl);
    const tmp = this.tmpDir();
    const rawFile = path.join(tmp, 'wave.raw');

    await runFfmpeg(
      ffmpeg(input)
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
      const input = this.resolveInput(seg.inputPath);
      await runFfmpeg(
        ffmpeg(input)
          .seekInput(seg.inPointMs / 1000)
          .duration((seg.outPointMs - seg.inPointMs) / 1000)
          .videoCodec('libx264')
          .audioCodec('aac')
          .addOption('-pix_fmt', 'yuv420p')
          .addOption('-preset', 'veryfast')
          .output(segFile),
      );
      segmentFiles.push(segFile);
    }

    const listFile = path.join(tmp, 'concat_list.txt');
    const concatList = segmentFiles
      .map((f) => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
      .join('\n');
    fs.writeFileSync(listFile, concatList);

    const outFile = path.join(tmp, 'final_output.mp4');
    await runFfmpeg(
      ffmpeg()
        .input(listFile)
        .inputFormat('concat')
        .inputOptions(['-safe 0'])
        .videoCodec('libx264')
        .audioCodec('aac')
        .addOption('-pix_fmt', 'yuv420p')
        .addOption('-preset', 'veryfast')
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

    const finalOutputPath = outputPath;
    const actualOutputPath = path.resolve(inputPath) === path.resolve(outputPath)
      ? path.join(this.tmpDir(), `effects-${path.basename(outputPath)}`)
      : outputPath;

    await runFfmpeg(
      ffmpeg(inputPath)
        .videoFilter(filterParts.join(','))
        .audioCodec('copy')
        .output(actualOutputPath),
    );

    if (actualOutputPath !== finalOutputPath) {
      fs.copyFileSync(actualOutputPath, finalOutputPath);
      fs.rmSync(path.dirname(actualOutputPath), { recursive: true, force: true });
    }

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

    const finalOutputPath = outputPath;
    const actualOutputPath = path.resolve(inputPath) === path.resolve(outputPath)
      ? path.join(this.tmpDir(), `text-${path.basename(outputPath)}`)
      : outputPath;

    await runFfmpeg(
      ffmpeg(inputPath)
        .videoFilter(drawtexts.join(','))
        .audioCodec('copy')
        .output(actualOutputPath),
    );

    if (actualOutputPath !== finalOutputPath) {
      fs.copyFileSync(actualOutputPath, finalOutputPath);
      fs.rmSync(path.dirname(actualOutputPath), { recursive: true, force: true });
    }

    this.logger.log(`Text overlays burned → ${outputPath}`);
    return outputPath;
  }
}
