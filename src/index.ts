import { AsyncSeriesWaterfallHook } from '@rspack/lite-tapable';
import {
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  existsSync,
  renameSync,
} from 'node:fs';
import { getLogger } from './utils/logger';
import { globSync } from 'glob';
import path from 'node:path';
import ReplacementPlugin, {
  ReplacementOption,
} from './build-in-plugins/replacement-plugin';

/**
 * @description copy folder content to other folder
 */

export interface CopyFolderPlugin {
  onBeforeCopy: (
    hook: AsyncSeriesWaterfallHook<CopyFolderPluginOptions>,
  ) => void;
}

type CopyFolderOptionRename = Record<string, string>;

export interface CopyFolderOptions {
  test?: RegExp; // filter file
  include?: string[] | string; // filter dir
  exclude?: string[] | string; // filter dir
  from: string;
  to: string;
  renameFiles?: CopyFolderOptionRename;
  replacements?: ReplacementOption[];
  plugins?: CopyFolderPlugin[];
}

interface InnnerCopyFolderOptions extends CopyFolderOptions {
  tempFile?: string;
  excludeMatches?: string[];
  includeMatches?: string[];
  onFinish?: () => void;
  readonly RawOptions: CopyFolderOptions;
}

export type CopyFolderHook = typeof pluginHook;

export interface CopyFolderPluginOptions extends InnnerCopyFolderOptions {
  filename: string;
}

const logger = getLogger('cpdir');

const pluginHook = new AsyncSeriesWaterfallHook<CopyFolderPluginOptions>([
  'options',
]);



export default (options: CopyFolderOptions) => {

  return new Promise((resolve) => {
    if (typeof options !== 'object') {
      throw new Error('options must be an object');
    }

    if (!options.to || typeof options.to !== 'string') {
      throw new Error('to must be a string');
    }

    if (!options.from || typeof options.from !== 'string') {
      throw new Error('from must be a string');
    }

    const { from, plugins = [], exclude = [], include = ['**/*'] } = options;
    let resultOptions = {
      ...options,
      RawOptions: options,
    } as InnnerCopyFolderOptions;

    let includeMatches = globSync(include, { cwd: from });
    resultOptions.includeMatches = includeMatches;

    let excludeMatches = globSync(exclude, { cwd: from });
    resultOptions.excludeMatches = excludeMatches;

    if (options.replacements) {
      plugins.unshift(new ReplacementPlugin(options.replacements));
    }

    registerPlugins(plugins);
    
    const onFinish = () => {
      logger.success(`\nCopy folders successfully.
  from: ${from}
  to: ${options.to}\n`)
      resolve("done")
    }
  
    resultOptions = { ...resultOptions, onFinish }
    copyFolder(resultOptions, true);
  }).catch(err => { 
    logger.error(err.message)
    return Promise.reject(err);
  })
};

function copyFolder(options: InnnerCopyFolderOptions, wrapFlag?: boolean) {
  const {
    from,
    to,
    excludeMatches = [],
    includeMatches,
    RawOptions: { from: RawFrom },
    onFinish,
    test: regExpTest,
  } = options;

  mkdirSync(to, { recursive: true });

  let count = 0;

  for (const filename of readdirSync(from)) {
    const excludeMatched = excludeMatches.find(
      (matched) => path.join(RawFrom, matched) === path.join(from, filename),
    );

    if (excludeMatched) continue;

    const includeMatched = includeMatches!.find(
      (matched) => path.join(RawFrom, matched) === path.join(from, filename),
    );

    if (!includeMatched) continue;

    // unmatched file
    if (regExpTest && !regExpTest.test(filename)) continue;

    pluginHook.callAsync(
      { ...options, filename },
      (
        err: Error | null,
        result: CopyFolderPluginOptions | null | undefined,
      ) => {
        const { from, to, renameFiles = {} } = result!;

        if (err) {
          throw err;
        } else {
          if (result === undefined || result === null) {
            return;
          }
          
          if (wrapFlag) {
            count++;
          }
          
          // rename file
          const _filename = handleRename(renameFiles, filename);

          const srcPath = path.resolve(from, filename);
          const targetPath = path.resolve(to, result!?.filename);

          if (statSync(srcPath).isDirectory()) {
            copyFolder({ ...result, from: srcPath, to: targetPath });
          } else {
            const { from, to } = result!;

            // copy file
            if (!existsSync(targetPath)) {
              copyFileSync(srcPath, targetPath);
            }

            if (_filename) {
              const finishPath = path.resolve(to, _filename);
              renameSync(targetPath, finishPath);
            }
          }

          if (wrapFlag) {
            if (readdirSync(from).length === count) {
              onFinish?.();
            }
          }
        }
      },
    );
  }
}

function registerPlugins(plugins: CopyFolderPlugin[]) {
  plugins.forEach((plugin) => {
    plugin.onBeforeCopy(pluginHook);
  });
}

const handleRename = (
  renameFiles: CopyFolderOptionRename,
  fileName: string,
) => {
  let result = fileName;

  Object.entries(renameFiles)?.find(([sourceName, targetName]) => {
    if (sourceName === fileName) {
      result = targetName;
      return true;
    }
  });

  return result;
};
