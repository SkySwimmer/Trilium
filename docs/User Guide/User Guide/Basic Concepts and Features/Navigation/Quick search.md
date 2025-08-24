# Quick search
<figure class="image image-style-align-center"><img style="aspect-ratio:659/256;" src="Quick search_image.png" width="659" height="256"></figure>

The _Quick search_ function does a full-text search (that is, it searches through the content of notes and not just the title of a note) and displays the result in an easy-to-access manner.

The alternative to the quick search is the <a class="reference-link" href="Search.md">Search</a> function, which opens in a dedicated tab and has support for advanced queries.

For even faster navigation, it's possible to use <a class="reference-link" href="Jump%20to.md">Jump to Note</a> which will only search through the note titles instead of the content.

## Layout

Based on the <a class="reference-link" href="../UI%20Elements/Vertical%20and%20horizontal%20layout.md">Vertical and horizontal layout</a>, the quick search is placed:

*   On the vertical layout, it is displayed right above the <a class="reference-link" href="../UI%20Elements/Note%20Tree.md">Note Tree</a>.
*   On the horizontal layout, it is displayed in the <a class="reference-link" href="../UI%20Elements/Launch%20Bar.md">Launch Bar</a>, where it can be positioned just like any other icon.

## Search Features

Quick search includes the following features:

### Content Previews

Search results now display a 200-character preview of the note content below the note title. This preview shows the context where your search terms appear, making it easier to identify the right note without opening it.

### Infinite Scrolling

Results are loaded progressively as you scroll:

*   Initial display shows 15 results
*   Scrolling near the bottom automatically loads 10 more results
*   Continue scrolling to load all matching notes

### Visual Features

*   **Highlighting**: Search terms appear in bold with accent colors
*   **Separation**: Results are separated with dividers
*   **Theme Support**: Highlighting colors adapt to light/dark themes

### Search Behavior

Quick search uses progressive search:

1.  Shows exact matches first
2.  Includes fuzzy matches when exact results are fewer than 5
3.  Exact matches appear before fuzzy matches

### Keyboard Navigation

*   Press `Enter` to open the first result
*   Use arrow keys to navigate through results
*   Press `Escape` to close the quick search

## Using Quick Search

1.  **Typo tolerance**: Search finds results despite minor typos
2.  **Content previews**: 200-character snippets show match context
3.  **Infinite scrolling**: Additional results load on scroll
4.  **Specific terms**: Specific search terms return more focused results
5.  **Match locations**: Bold text indicates where matches occur