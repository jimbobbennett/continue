import { IDE, TabAutocompleteOptions } from "..";
import {
  AutocompleteLanguageInfo,
  languageForFilepath,
} from "./constants/AutocompleteLanguageInfo";
import { constructInitialPrefixSuffix } from "./templating/constructPrefixSuffix";
import { AutocompleteInput } from "./types";
import { AstPath, getAst, getTreePathAtCursor } from "./util/ast";

/**
 * A collection of variables that are often accessed throughout the autocomplete pipeline
 * It's noisy to re-calculate all the time or inject them into each function
 */
export class HelperVars {
  lang: AutocompleteLanguageInfo;
  treePath: AstPath | undefined;

  private _fileContents: string | undefined;
  private _fileLines: string[] | undefined;
  private _fullPrefix: string | undefined;
  private _fullSuffix: string | undefined;

  private constructor(
    public readonly input: AutocompleteInput,
    public readonly options: TabAutocompleteOptions,
    public readonly modelName: string,
    private readonly ide: IDE,
  ) {
    this.lang = languageForFilepath(input.filepath);
  }

  private async init() {
    // Don't do anything if already initialized
    if (this._fileContents !== undefined) return;

    this._fileContents =
      this.input.manuallyPassFileContents ??
      (await this.ide.readFile(this.filepath));

    this._fileLines = this._fileContents.split("\n");

    // Construct full prefix/suffix (a few edge cases handled in here)
    const { prefix: fullPrefix, suffix: fullSuffix } =
      await constructInitialPrefixSuffix(this.input, this.ide);
    this._fullPrefix = fullPrefix;
    this._fullSuffix = fullSuffix;

    try {
      const ast = await getAst(this.filepath, fullPrefix + fullSuffix);
      if (ast) {
        this.treePath = await getTreePathAtCursor(ast, fullPrefix.length);
      }
    } catch (e) {
      console.error("Failed to parse AST", e);
    }
  }

  static async create(
    input: AutocompleteInput,
    options: TabAutocompleteOptions,
    modelName: string,
    ide: IDE,
  ): Promise<HelperVars> {
    const instance = new HelperVars(input, options, modelName, ide);
    await instance.init();
    return instance;
  }

  // Fast access
  get filepath() {
    return this.input.filepath;
  }
  get pos() {
    return this.input.pos;
  }
  get maxSnippetTokens() {
    return this.options.maxPromptTokens * this.options.maxSnippetPercentage;
  }

  // Getters for lazy access
  get fileContents(): string {
    if (this._fileContents === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing fileContents",
      );
    }
    return this._fileContents;
  }

  get fileLines(): string[] {
    if (this._fileLines === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing fileLines",
      );
    }
    return this._fileLines;
  }

  get fullPrefix(): string {
    if (this._fullPrefix === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing fullPrefix",
      );
    }
    return this._fullPrefix;
  }

  get fullSuffix(): string {
    if (this._fullSuffix === undefined) {
      throw new Error(
        "HelperVars must be initialized before accessing fullSuffix",
      );
    }
    return this._fullSuffix;
  }
}
