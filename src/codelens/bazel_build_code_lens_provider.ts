// Copyright 2018 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as path from "path";
import * as vscode from "vscode";

import { BazelQuery, getBazelWorkspaceFolder, QueryResult } from "../bazel";
import { CodeLensCommandAdapter } from "./code_lens_command_adapter";

/** Provids CodeLenses for targets in Bazel BUILD files. */
export class BazelBuildCodeLensProvider implements vscode.CodeLensProvider {
  /**
   * Provides promisified CodeLen(s) for the given document.
   *
   * @param document A Bazel BUILD file
   * @param token CodeLens token automatically generated by VS Code when
   *     invoking the provider
   */
  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): Promise<vscode.CodeLens[]> {
    const workspace = getBazelWorkspaceFolder(document.uri.fsPath);
    if (workspace === undefined) {
      vscode.window.showWarningMessage(
        "Bazel BUILD CodeLens unavailable as currently opened file is not in " +
        "a Bazel workspace",
      );
      return [];
    }
    // Path to the BUILD file relative to the workspace.
    const relPathToDoc = path.relative(workspace, document.uri.fsPath);
    // Strip away the name of the BUILD file from the relative path.
    let relDirWithDoc = path.dirname(relPathToDoc);
    // Strip away the "." if the BUILD file was in the same directory as the
    // workspace.
    if (relDirWithDoc === ".") {
      relDirWithDoc = "";
    }
    // Turn the relative path into a package label
    const pkg = `//${relDirWithDoc}`;
    const queryResult = await new BazelQuery(
      workspace,
      `'kind(rule, ${pkg}:all)'`,
      [],
    ).runAndParse();
    return this.addCodeLens(workspace, queryResult);
  }

  /**
   * Takes the result of a Bazel query for targets defined in a package and
   * returns a list of CodeLens for the BUILD file in that package.
   *
   * @param bazelWorkspaceDirectory The Bazel workspace directory.
   * @param queryResult The result of the bazel query.
   */
  private addCodeLens(
    bazelWorkspaceDirectory: string,
    queryResult: QueryResult,
  ): vscode.CodeLens[] {
    const result = [];

    for (const rule of queryResult.rules) {
      const loc = rule.location;
      const target = rule.name;
      let cmd: vscode.Command;
      if (rule.ruleClass.endsWith("_test")) {
        cmd = {
          arguments: [
            new CodeLensCommandAdapter(bazelWorkspaceDirectory, [target]),
          ],
          command: "bazel.testTarget",
          title: `Test ${target}`,
          tooltip: `Build ${target}`,
        };
      } else {
        cmd = {
          arguments: [
            new CodeLensCommandAdapter(bazelWorkspaceDirectory, [target]),
          ],
          command: "bazel.buildTarget",
          title: `Build ${target}`,
          tooltip: `Build ${target}`,
        };
      }
      result.push(new vscode.CodeLens(loc.range, cmd));
    }

    return result;
  }
}
