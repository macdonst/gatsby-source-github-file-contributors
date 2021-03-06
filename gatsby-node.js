/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const globby = require('globby')
const { githubFetchContributorsForPage } = require('./src/gql')
const path = require('path')

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions
  const typeDefs = `
    type Contributors implements Node {
      date: String,
      login: String,
      name: String,
      avatarUrl: String
    }
    type GithubContributors implements Node {
      contributors: [Contributors]
    }
  `
  createTypes(typeDefs)
}

exports.sourceNodes = async (
  { actions, createNodeId, createContentDigest },
  options = {}
) => {
  const root = options.pages.root ? options.pages.root : ''
  const {
    paths: pages = ['src/pages'],
    extensions = ['md', 'mdx'],
    prefix = ''
  } = options.pages ? options.pages : {}
  const {
    token,
    owner,
    name,
    branch = 'main',
    api = 'https://api.github.com/graphql'
  } = options.repo ? options.repo : {}

  if (!token) {
    console.warn(
      'To get Github Contributors, a Github token is required (GITHUB_TOKEN environment variable)'
    )
  }

  const paths = await globby(
    pages.map((page) => path.resolve(process.cwd(), page)),
    {
      expandDirectories: {
        extensions
      }
    }
  )

  const repository = `${owner}/${name}`

  actions.createNode({
    repository,
    branch,
    root,
    id: createNodeId(repository),
    internal: {
      type: 'Github',
      contentDigest: createContentDigest(repository)
    }
  })

  for (const _path of paths) {
    let githubPath = _path.replace(root, '')
    if (githubPath.charAt(0) === path.sep) githubPath = githubPath.substr(1)
    if (prefix && githubPath.startsWith(prefix)) {
      githubPath = githubPath.slice(prefix.length + 1)
    }

    let contributors = []
    if (token) {
      try {
        contributors = await githubFetchContributorsForPage(
          api,
          owner,
          name,
          branch,
          githubPath,
          token
        )
      } catch (error) {
        console.log(error)
      }
    }

    actions.createNode({
      contributors,
      path: _path,
      id: createNodeId(_path),
      internal: {
        type: 'GithubContributors',
        contentDigest: createContentDigest(_path)
      }
    })
  }
}
