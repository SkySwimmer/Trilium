# Quick Search - Exact Match Operator

## Overview

Quick Search now supports the exact match operator (`=`) at the beginning of your search query. This allows you to search for notes where the title or content exactly matches your search term, rather than just containing it.

## Usage

To use exact match in Quick Search:

1. Start your search query with the `=` operator
2. Follow it immediately with your search term (no space after `=`)

### Examples

- `=example` - Finds notes with title exactly "example" or content exactly "example"
- `=Project Plan` - Finds notes with title exactly "Project Plan" or content exactly "Project Plan"
- `='hello world'` - Use quotes for multi-word exact matches

### Comparison with Regular Search

| Query | Behavior |
|-------|----------|
| `example` | Finds all notes containing "example" anywhere in title or content |
| `=example` | Finds only notes where the title equals "example" or content equals "example" exactly |

## Technical Details

When you use the `=` operator:
- The search performs an exact match on note titles
- For note content, it looks for exact matches of the entire content
- Partial word matches are excluded
- The search is case-insensitive

## Limitations

- The `=` operator must be at the very beginning of the search query
- Spaces after `=` will treat it as a regular search
- Multiple `=` operators (like `==example`) are treated as regular text search

## Use Cases

This feature is particularly useful when:
- You know the exact title of a note
- You want to find notes with specific, complete content
- You need to distinguish between notes with similar but not identical titles
- You want to avoid false positives from partial matches

## Related Features

- For more complex exact matching queries, use the full [Search](Search.md) functionality
- For fuzzy matching (finding results despite typos), use the `~=` operator in the full search
- For partial matches with wildcards, use operators like `*=*`, `=*`, or `*=` in the full search