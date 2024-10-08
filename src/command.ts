import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import cpdirplus from '.';

interface YargsResultOptions {
  _: string[];
  t: string;
  f: string;
  to: string;
  from: string;
  move?: boolean;
  m?: boolean;
  b?: string;
  base?: string;
  $0: string;
}

export class CPDirPlusCLI {
  name = 'cpdirplus';
  constructor(private argv: string[]) {}
  async run() {
    const result = yargs(hideBin(this.argv))
      .usage('Usage: cpdirplus [options] <command>')
      .option('move', {
        alias: 'm',
        default: false,
        describe: 'move source folder',
        type: 'boolean',
        demandOption: false,
      })
      .command('[sourcePath] [targetPath]', 'target folder')
      .option('from', {
        alias: 'f',
        describe: 'source folder',
        type: 'string',
        demandOption: true,
      })
      .option('to', {
        alias: 't',
        describe: 'target folder',
        type: 'string',
        demandOption: true,
      })
      .option('base', {
        alias: 'b',
        describe: 'base folder',
        type: 'string',
        demandOption: false,
      })
      .version()
      .alias({
        h: 'help',
        v: 'version',
      })
      .locale('en')
      .help()
      .fail(() => {})
      .parse() as unknown as YargsResultOptions;

    await this.execCommand(result);
  }

  private async execCommand(option: YargsResultOptions) {
    if (!option.to) {
      option.t = option.to = option['_'][1];
    }

    if (!option.from) {
      option.f = option.from = option['_'][0];
    }

    const { from, to, ...restOptions } = option;

    try {
      await cpdirplus(from, to, restOptions);
    } catch (e) {}
  }
}
