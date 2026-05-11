export class FFmpeg {
  on(_event: string, _handler: any) { return this; }
  off(_event: string, _handler: any) { return this; }
  async load(_options?: any) {}
  async writeFile(_name: string, _data: any) {}
  async readFile(_name: string): Promise<Uint8Array> { return new Uint8Array(8); }
  async deleteFile(_name: string) {}
  async exec(_args: string[]): Promise<number> { return 0; }
}
