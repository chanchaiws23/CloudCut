export class FFmpeg {
  on(_event: string, _handler: any) {}
  off(_event: string, _handler: any) {}
  async load(_options?: any) {}
  async writeFile(_name: string, _data: any) {}
  async readFile(_name: string): Promise<Uint8Array> { return new Uint8Array(); }
  async deleteFile(_name: string) {}
  async exec(_args: string[]) {}
}
