'use babel';

import PersistentBookmarksView from './persistent-bookmarks-view';
import { CompositeDisposable } from 'atom';

export default {

  persistentBookmarksView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.persistentBookmarksView = new PersistentBookmarksView(state.persistentBookmarksViewState);
    this.persistentBookmarksView.parent = this;
    this.hide.bind(this);
    this.show.bind(this);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.persistentBookmarksView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'persistent-bookmarks:toggle-bookmark': () => this.toggleBookmark(),
      'persistent-bookmarks:view-all': () => this.toggle()
    }));

    this.subscriptions.add(atom.workspace.observeTextEditors(this.persistentBookmarksView.restoreBookmarks))
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.persistentBookmarksView.destroy();
  },

  serialize() {
    return {
      persistentBookmarksViewState: this.persistentBookmarksView.serialize()
    };
  },

  toggleBookmark() {
    this.persistentBookmarksView.toggleBookmark();
  },

  toggle() {
    return (
      this.modalPanel.isVisible() ?
      this.hide() :
      this.show()
    );
  },

  hide() {
    this.modalPanel.hide();
  },

  show() {
    this.persistentBookmarksView.refreshSelectList();
    this.modalPanel.show();
    this.persistentBookmarksView.focusOnSelectListInput();
  }

};
