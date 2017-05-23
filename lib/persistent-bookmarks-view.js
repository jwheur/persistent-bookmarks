'use babel';
import SelectListView from 'atom-select-list'
import {CompositeDisposable} from 'atom'

export default class PersistentBookmarksView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('persistent-bookmarks');
    this.markerLayerIds = {};
    this.markerLayers = [];
    this.decorationLayers = [];
    this.disposables = new CompositeDisposable();
    this.bookmarkStore = {};
    if(serializedState && serializedState.bookmarkStore) {
      this.bookmarkStore = serializedState.bookmarkStore
    }

    this.initSelectList();
    this.element.appendChild(this.selectList.element);
  }

  restoreBookmarks = (item)=> {
    if(!item) { return; }
    if(!item.getPath) { return; }
    const bookmarks = this.bookmarkStore[item.getPath()];
    if(!bookmarks) {
      return;
    }
    this.initMarkerLayer(item);
    const markerLayer = this.getMarkerLayer(item);
    for(const bookmark of bookmarks) {
      const range = bookmark.range
      const marker = markerLayer.markBufferRange(range, {invalidate: "surround", exclusive: true})
      this.disposables.add(marker.onDidChange(({isValid}) => {
        if (!isValid) {
          marker.destroy();
        }
      }))
    }
  }

  initSelectList() {
    this.selectList = new SelectListView({
      emptyMessage: 'No bookmarks found',
      items: [],
      filterKeyForItem: (bookmark) => {
        return bookmark.filterText
      },
      didConfirmSelection: (item) => {
        this.parent.hide();
        this.goToBookmark(item)
      },
      didCancelSelection: () => {
        this.parent.hide();
      },
      elementForItem: (item) => {
        const li = document.createElement('li')
        li.classList.add('bookmark')
        const primaryLine = document.createElement('div')
        primaryLine.classList.add('primary-line')
        primaryLine.textContent = `${item.relativePath} : ${item.line}`
        li.appendChild(primaryLine)
        bookmarkContent = item.bookmarkContent
        if (bookmarkContent) {
          const secondaryLine = document.createElement('div')
          secondaryLine.classList.add('secondary-line', 'line-text')
          secondaryLine.textContent = bookmarkContent
          li.appendChild(secondaryLine)
          li.classList.add('two-lines')
        }
        return li
      }
    })
  }

  goToBookmark(item) {
    this.parent.hide()
    const filePath = item.filePath
    const line = item.line
    atom.workspace.open(filePath, { initialLine: line })
  }

  toggleBookmark() {
    editor = this.getActiveTextEditor();
    this.initMarkerLayer(editor);
    this.toggleBookmarkForSelectedRanges(editor);
  }

  toggleBookmarkForSelectedRanges(editor) {
    ranges = editor.getSelectedBufferRanges();
    markerLayer = this.getMarkerLayer(editor);
    for (const range of ranges) {
      this.toggleBookmarkForRange(editor, markerLayer, range);
    }
  }

  toggleBookmarkForRange(editor, markerLayer, range) {
    const bookmarks = markerLayer.findMarkers({intersectsRowRange: [range.start.row, range.end.row]})
    let shouldStoreBookmark = false;
    if (bookmarks && bookmarks.length > 0) {
      for (const bookmark of bookmarks) {
        bookmark.destroy();
      }
    } else {
      shouldStoreBookmark = true;
      const bookmark = markerLayer.markBufferRange(range, {invalidate: "surround", exclusive: true})
      this.disposables.add(bookmark.onDidChange(({isValid}) => {
        if (!isValid) {
          bookmark.destroy();
        }
      }))
    }

    const path = editor.getPath();
    if(shouldStoreBookmark) {
      if(!this.bookmarkStore[path]) {
        this.bookmarkStore[path] = [];
      }
      const bookmarkContent = editor.lineTextForBufferRow(range.start.row).trim()
      const relativePath = atom.project.relativizePath(path)[1]
      this.bookmarkStore[path].push({
        range: range,
        bookmarkContent: bookmarkContent,
        relativePath: relativePath,
        filterText: `${range.start.row} ${relativePath} ${bookmarkContent}`,
        createdAt: Date.now()
      });
    } else {
      if(this.bookmarkStore[path]) {
        const updatedBookmarks = [];
        for(const bookmark of this.bookmarkStore[path]) {
          if(bookmark.range.start.row != range.start.row) {
            updatedBookmarks.push(bookmark);
          }
        }
        this.bookmarkStore[path] = updatedBookmarks
      }
    }
  }

  initMarkerLayer(editor) {
    const path = editor.getPath();
    const existingLayer = this.getMarkerLayer(editor);
    if(existingLayer) {
      return;
    }
    const markerLayer = editor.addMarkerLayer({persistent: true});
    const decorationLayer = editor.decorateMarkerLayer(markerLayer, {type: "line-number", class: "bookmarked"})
    this.markerLayerIds[path] = markerLayer.id;
    this.markerLayers.push(markerLayer);
    this.decorationLayers.push(decorationLayer);
  }

  clearAll() {
    const textEditors = atom.workspace.getTextEditors()
    for(const editor of textEditors) {
      const markerLayer = this.getMarkerLayer(editor)
      if(markerLayer) {
        markerLayer.destroy()
      }
    }
    this.bookmarkStore = {}
    this.markerLayerIds = {}
  }

  getMarkerLayer(editor) {
    const path = editor.getPath();
    const markerLayerId = this.markerLayerIds[path];
    if(!markerLayerId) {
      return undefined;
    }
    return editor.getMarkerLayer(markerLayerId);
  }

  focusOnSelectListInput() {
    this.selectList.focus();
  }

  refreshSelectList = () => {
    const items = []
    for(const path in this.bookmarkStore) {
      const bookmarks = this.bookmarkStore[path]
      for(bookmark of bookmarks) {
        const item = {
          filePath: path,
          relativePath: bookmark.relativePath,
          line: bookmark.range.start.row,
          bookmarkContent: bookmark.bookmarkContent,
          filterText: bookmark.filterText,
          createdAt: bookmark.createdAt
        }
        items.push(item)
      }
    }
    items.sort(function(a, b){
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    this.selectList.update({items: items})
  }

  // Returns an object that can be retrieved when package is activated
  serialize = () => {
    return { bookmarkStore: this.bookmarkStore }
  }

  // Tear down any state and detach
  destroy() {
    this.element.remove();
    this.disposables.dispose();
    for(const markerLayer of this.markerLayers) {
      markerLayer.destroy();
    }
    for(const decorationLayer of this.decorationLayers) {
      decorationLayer.destroy();
    }
  }

  getElement() {
    return this.element;
  }

  getActiveTextEditor = ()=> {
    return atom.workspace.getActiveTextEditor();
  }
}
