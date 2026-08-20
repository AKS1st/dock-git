window.__ModuleLoader__.load({
	id: "dock-git",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		//#region src/client/constants.ts
		/**
		* Shared client constants for dock-git. Kept in their own module (instead of
		* exporting from client/index.ts) so GitLauncher and CommitView can
		* import them without a circular dependency through the entry module.
		*/
		/** The editor-view id hosting the git history (opened in a floating window). */
		const GRAPH_VIEW_ID = "git-history";
		//#endregion
		//#region src/client/i18n.ts
		/** Complete dictionaries — every key below exists in BOTH locales. */
		const DICTS = {
			zh: {
				graphTitle: "提交历史",
				notRepo: "当前工作区不是 git 仓库",
				notRepoHint: "该目录下没有找到 git 仓库",
				noCommits: "没有提交",
				commitsCount: "{n} 个提交",
				refresh: "刷新",
				loadMore: "加载更多",
				loading: "加载中…",
				error: "加载失败",
				retry: "重试",
				close: "关闭",
				allBranches: "全部",
				showRemoteBranches: "显示远程分支",
				settings: "设置",
				uncommittedChanges: "未提交的更改",
				emptyRepo: "空仓库",
				justNow: "刚刚",
				minutesAgo: "{n} 分钟前",
				hoursAgo: "{n} 小时前",
				noSession: "无会话",
				viewDetails: "查看详情",
				copyCommitHash: "复制提交哈希",
				copyCommitSubject: "复制提交标题",
				copyCommitBody: "复制提交正文",
				createBranch: "创建分支…",
				addTag: "添加标签…",
				checkoutCommit: "检出…",
				confirmCheckout: "确认检出 {ref}?",
				checkoutBranch: "检出分支",
				pushBranch: "推送分支…",
				renameBranch: "重命名…",
				deleteBranch: "删除分支…",
				confirmDeleteBranch: "确定要删除分支 {name}?",
				copyBranchName: "复制分支名",
				pushTag: "推送标签…",
				deleteTag: "删除标签…",
				confirmDeleteTag: "确定要删除标签 {name}?",
				copyTagName: "复制标签名",
				dialogOk: "确定",
				dialogCancel: "取消",
				createBranchTitle: "创建分支",
				addTagTitle: "添加标签",
				renameBranchTitle: "重命名分支",
				deleteBranchTitle: "删除分支",
				deleteTagTitle: "删除标签",
				checkoutTitle: "检出",
				promptBranchName: "分支名:",
				promptNewBranchName: "新分支名:",
				promptTagName: "标签名:",
				pushDialogTitleBranch: "推送分支",
				pushDialogTitleTag: "推送标签",
				pushBranchLabel: "分支",
				pushRemoteLabel: "远程",
				pushSetUpstream: "设置上游",
				pushModeLabel: "推送模式",
				pushModeNormal: "正常",
				pushModeForce: "强制(Force With Lease)",
				operationFailed: "操作失败: {msg}",
				operationBusy: "有操作正在进行,请稍候",
				operationDone: "{msg}",
				branchCreated: "已创建分支 {name}",
				branchRenamed: "已重命名分支为 {name}",
				branchDeleted: "已删除分支 {name}",
				tagCreated: "已创建标签 {name}",
				tagDeleted: "已删除标签 {name}",
				checkedOut: "已检出 {ref}",
				pushBranchDone: "已推送分支",
				pushTagDone: "已推送标签",
				fetchButton: "Fetch",
				fetchDone: "已从远程更新",
				pullIntoCurrent: "拉取到当前分支",
				confirmPull: "将 {remote}/{branch} 拉取合并到当前分支?",
				fetchIntoLocal: "拉取到本地分支…",
				promptLocalBranch: "本地分支名:",
				pullDone: "已拉取 {remote}/{branch}",
				fetchIntoDone: "已拉取 {remote}/{remoteBranch} → {localBranch}",
				copyRemoteName: "复制远程分支名",
				commitLabel: "提交: ",
				parentsLabel: "父提交: ",
				authorLabel: "作者: ",
				authorDateLabel: "作者时间: ",
				committerLabel: "提交者: ",
				committerDateLabel: "提交时间: ",
				root: "(根提交)",
				beforeLabel: "修改前",
				afterLabel: "修改后",
				filesLabel: "文件",
				noFileSelected: "选择文件查看内容",
				fileMissingAdd: "文件不存在(新增)",
				fileMissingDelete: "文件不存在(删除)",
				binaryFile: "二进制文件",
				dragHint: "拖动调整高度",
				contentTooLong: "内容过长,仅显示前 {n} 行",
				diffRowsTooLong: "差异行过多,仅显示前 {n} 行",
				commitPanelTitle: "更改",
				stageAll: "全部暂存",
				stage: "暂存",
				unstage: "取消暂存",
				commitMessagePlaceholder: "提交消息(必填)",
				commitButton: "提交",
				noChanges: "没有更改",
				emptyMessage: "请输入提交消息",
				commitDone: "已提交 {hash}",
				gitUserSection: "Git 用户",
				userNameLabel: "用户名",
				userEmailLabel: "邮箱",
				save: "保存",
				saved: "已保存",
				remotesSection: "远程仓库",
				addRemote: "添加",
				remoteNamePlaceholder: "名称",
				remoteUrlPlaceholder: "URL",
				removeRemote: "移除",
				updateUrl: "更新 URL",
				displaySection: "显示",
				dateFormatLabel: "日期格式",
				dateRelative: "相对时间",
				dateAbsolute: "绝对时间",
				languageLabel: "语言",
				followSystem: "跟随系统",
				backToGraph: "返回",
				emptyRemotes: "没有远程仓库",
				promptSetUrl: "新 URL:",
				confirmRemoveRemote: "确定要移除远程仓库 {name}?",
				repoSelectorTitle: "git仓库列表",
				repoListHint: "选择要查看的仓库",
				noReposFound: "未找到 git 仓库",
				depthWorkspace: "工作区",
				depthSub: "子目录",
				depthNested: "孙目录",
				openRepo: "打开仓库"
			},
			en: {
				graphTitle: "Git History",
				notRepo: "The current workspace is not a git repository",
				notRepoHint: "No git repository found in this directory",
				noCommits: "No commits",
				commitsCount: "{n} commits",
				refresh: "Refresh",
				loadMore: "Load More",
				loading: "Loading…",
				error: "Load failed",
				retry: "Retry",
				close: "Close",
				allBranches: "All branches",
				showRemoteBranches: "Show remote branches",
				settings: "Settings",
				uncommittedChanges: "Uncommitted Changes",
				emptyRepo: "Empty repository",
				justNow: "Just now",
				minutesAgo: "{n} min ago",
				hoursAgo: "{n} hr ago",
				noSession: "No session",
				viewDetails: "View Details",
				copyCommitHash: "Copy Commit Hash",
				copyCommitSubject: "Copy Commit Subject",
				copyCommitBody: "Copy Commit Body",
				createBranch: "Create Branch…",
				addTag: "Add Tag…",
				checkoutCommit: "Checkout…",
				confirmCheckout: "Checkout {ref}?",
				checkoutBranch: "Checkout Branch",
				pushBranch: "Push Branch…",
				renameBranch: "Rename…",
				deleteBranch: "Delete Branch…",
				confirmDeleteBranch: "Delete branch {name}?",
				copyBranchName: "Copy Branch Name",
				pushTag: "Push Tag…",
				deleteTag: "Delete Tag…",
				confirmDeleteTag: "Delete tag {name}?",
				copyTagName: "Copy Tag Name",
				dialogOk: "OK",
				dialogCancel: "Cancel",
				createBranchTitle: "Create Branch",
				addTagTitle: "Add Tag",
				renameBranchTitle: "Rename Branch",
				deleteBranchTitle: "Delete Branch",
				deleteTagTitle: "Delete Tag",
				checkoutTitle: "Checkout",
				promptBranchName: "Branch name:",
				promptNewBranchName: "New branch name:",
				promptTagName: "Tag name:",
				pushDialogTitleBranch: "Push Branch",
				pushDialogTitleTag: "Push Tag",
				pushBranchLabel: "Branch",
				pushRemoteLabel: "Remote",
				pushSetUpstream: "Set upstream",
				pushModeLabel: "Push mode",
				pushModeNormal: "Normal",
				pushModeForce: "Force With Lease",
				operationFailed: "Operation failed: {msg}",
				operationBusy: "An operation is already in progress, please wait",
				operationDone: "{msg}",
				branchCreated: "Branch {name} created",
				branchRenamed: "Branch renamed to {name}",
				branchDeleted: "Branch {name} deleted",
				tagCreated: "Tag {name} created",
				tagDeleted: "Tag {name} deleted",
				checkedOut: "Checked out {ref}",
				pushBranchDone: "Branch pushed",
				pushTagDone: "Tag pushed",
				fetchButton: "Fetch",
				fetchDone: "Fetched from remotes",
				pullIntoCurrent: "Pull into current branch",
				confirmPull: "Pull {remote}/{branch} into the current branch?",
				fetchIntoLocal: "Fetch into local branch…",
				promptLocalBranch: "Local branch name:",
				pullDone: "Pulled {remote}/{branch}",
				fetchIntoDone: "Fetched {remote}/{remoteBranch} → {localBranch}",
				copyRemoteName: "Copy Remote Branch Name",
				commitLabel: "Commit: ",
				parentsLabel: "Parents: ",
				authorLabel: "Author: ",
				authorDateLabel: "Author Date: ",
				committerLabel: "Committer: ",
				committerDateLabel: "Committer Date: ",
				root: "(root)",
				beforeLabel: "Before",
				afterLabel: "After",
				filesLabel: "Files",
				noFileSelected: "Select a file to view",
				fileMissingAdd: "File does not exist (added)",
				fileMissingDelete: "File does not exist (deleted)",
				binaryFile: "Binary file",
				dragHint: "Drag to resize",
				contentTooLong: "Content too long, showing the first {n} lines",
				diffRowsTooLong: "Too many diff rows, showing the first {n}",
				commitPanelTitle: "Changes",
				stageAll: "Stage All",
				stage: "Stage",
				unstage: "Unstage",
				commitMessagePlaceholder: "Commit message (required)",
				commitButton: "Commit",
				noChanges: "No changes",
				emptyMessage: "Enter a commit message",
				commitDone: "Committed {hash}",
				gitUserSection: "Git User",
				userNameLabel: "User name",
				userEmailLabel: "Email",
				save: "Save",
				saved: "Saved",
				remotesSection: "Remotes",
				addRemote: "Add",
				remoteNamePlaceholder: "Name",
				remoteUrlPlaceholder: "URL",
				removeRemote: "Remove",
				updateUrl: "Update URL",
				displaySection: "Display",
				dateFormatLabel: "Date format",
				dateRelative: "Relative",
				dateAbsolute: "Absolute",
				languageLabel: "Language",
				followSystem: "Follow system",
				backToGraph: "Back",
				emptyRemotes: "No remotes",
				promptSetUrl: "New URL:",
				confirmRemoveRemote: "Remove remote {name}?",
				repoSelectorTitle: "Git Repositories",
				repoListHint: "Select a repository to view",
				noReposFound: "No git repositories found",
				depthWorkspace: "workspace",
				depthSub: "subdirectory",
				depthNested: "nested",
				openRepo: "Open repository"
			}
		};
		/**
		* Look up a dictionary key for a locale. Missing key → zh fallback → the key
		* itself (never blank). `{name}` placeholders are replaced from `params`.
		*/
		function translate(locale, key, params) {
			const template = DICTS[locale]?.[key] ?? DICTS.zh[key] ?? key;
			if (params === void 0) return template;
			return template.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match);
		}
		/**
		* Resolve the active locale: the DSH locale service
		* (`ctx.get('locale')?.getSnapshot?.()?.active`, 'zh' | 'en') wins; otherwise
		* the browser language (`navigator.language.startsWith('zh')`) decides, with
		* English as the last resort. `ctx` may be absent (standalone runs).
		*/
		function detectLocale(ctx) {
			const active = (ctx?.get?.("locale"))?.getSnapshot?.()?.active;
			if (active === "zh" || active === "en") return active;
			if (typeof navigator !== "undefined" && typeof navigator.language === "string" && navigator.language.toLowerCase().startsWith("zh")) return "zh";
			return "en";
		}
		//#endregion
		//#region src/client/hooks.ts
		/**
		* Shared client hooks for dock-git: the locale subscription hook and the
		* translate-bound function type. i18n.ts stays pure (no React import) so
		* scripts/smoke-i18n.mjs can run it standalone; the React glue lives here.
		*/
		/**
		* The active DSH locale, re-resolved on every 'locale/change' event (the
		* locale service publishes the snapshot the same way getSnapshot does).
		*/
		function useLocale(ctx) {
			const [locale, setLocale] = (0, react.useState)(() => detectLocale(ctx));
			(0, react.useEffect)(() => ctx.on("locale/change", () => setLocale(detectLocale(ctx))), [ctx]);
			return locale;
		}
		//#endregion
		//#region src/client/diff.ts
		const DEFAULT_MAX_LINES = 5e3;
		/** DP cell budget — beyond this the middle region degrades to "all changed". */
		const DP_BUDGET = 1e6;
		/**
		* Split `text` into lines, removing a trailing empty line produced by a
		* final `\n`.  An empty (or whitespace-only) string yields an empty array.
		*/
		function splitLines(text) {
			if (text === "") return [];
			const lines = text.split("\n");
			if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
			return lines;
		}
		/**
		* Count the length of the common prefix of two string arrays.
		*/
		function commonPrefixLen(a, b) {
			const len = Math.min(a.length, b.length);
			let i = 0;
			while (i < len && a[i] === b[i]) i++;
			return i;
		}
		/**
		* Count the length of the common suffix of two string arrays, bounded so
		* that prefix + suffix never exceeds the shorter array.
		*/
		function commonSuffixLen(a, b, prefixLen) {
			const maxSuffix = Math.min(a.length, b.length) - prefixLen;
			let i = 0;
			while (i < maxSuffix && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
			return i;
		}
		/**
		* LCS-align two string arrays and return aligned `DiffRow[]` for the
		* middle region only (prefix/suffix are handled by the caller).
		*
		* If `oldMid.length × newMid.length` exceeds `DP_BUDGET`, the function
		* degrades: every old line becomes a `del` row, every new line becomes an
		* `add` row (interleaved: all dels first, then all adds).
		*/
		function alignMiddle(oldMid, newMid) {
			const oldLen = oldMid.length;
			const newLen = newMid.length;
			if (oldLen * newLen > DP_BUDGET) {
				const rows = [];
				for (let i = 0; i < oldLen; i++) rows.push({ old: {
					text: oldMid[i],
					type: "del"
				} });
				for (let j = 0; j < newLen; j++) rows.push({ new: {
					text: newMid[j],
					type: "add"
				} });
				return rows;
			}
			const dp = [];
			for (let i = 0; i <= oldLen; i++) dp[i] = new Array(newLen + 1).fill(0);
			for (let i = 1; i <= oldLen; i++) for (let j = 1; j <= newLen; j++) if (oldMid[i - 1] === newMid[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
			else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			const moves = [];
			let i = oldLen;
			let j = newLen;
			while (i > 0 || j > 0) if (i > 0 && j > 0 && oldMid[i - 1] === newMid[j - 1]) {
				moves.push({
					kind: "same",
					oldIdx: i - 1,
					newIdx: j - 1
				});
				i--;
				j--;
			} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
				moves.push({
					kind: "add",
					newIdx: j - 1
				});
				j--;
			} else {
				moves.push({
					kind: "del",
					oldIdx: i - 1
				});
				i--;
			}
			moves.reverse();
			const rows = [];
			for (const move of moves) if (move.kind === "same") rows.push({
				old: {
					text: oldMid[move.oldIdx],
					type: "same"
				},
				new: {
					text: newMid[move.newIdx],
					type: "same"
				}
			});
			else if (move.kind === "del") rows.push({ old: {
				text: oldMid[move.oldIdx],
				type: "del"
			} });
			else rows.push({ new: {
				text: newMid[move.newIdx],
				type: "add"
			} });
			return rows;
		}
		/**
		* Compute a side-by-side line-level diff between two strings.
		*
		* @param oldText  Content before the change (empty string for pure adds).
		* @param newText  Content after the change (empty string for pure deletes).
		* @param maxLines Maximum input lines (default 5000); excess lines are
		*                 truncated before diffing.
		* @returns Array of aligned `DiffRow` objects ready for rendering.
		*/
		function diffText(oldText, newText, maxLines) {
			const limit = maxLines ?? DEFAULT_MAX_LINES;
			let oldLines = splitLines(oldText);
			let newLines = splitLines(newText);
			if (oldLines.length > limit) oldLines = oldLines.slice(0, limit);
			if (newLines.length > limit) newLines = newLines.slice(0, limit);
			if (oldLines.length === 0 && newLines.length === 0) return [];
			if (oldLines.length === 0) return newLines.map((text) => ({ new: {
				text,
				type: "add"
			} }));
			if (newLines.length === 0) return oldLines.map((text) => ({ old: {
				text,
				type: "del"
			} }));
			const prefixLen = commonPrefixLen(oldLines, newLines);
			const suffixLen = commonSuffixLen(oldLines, newLines, prefixLen);
			const rows = [];
			for (let i = 0; i < prefixLen; i++) rows.push({
				old: {
					text: oldLines[i],
					type: "same"
				},
				new: {
					text: newLines[i],
					type: "same"
				}
			});
			const oldMid = oldLines.slice(prefixLen, oldLines.length - suffixLen);
			const newMid = newLines.slice(prefixLen, newLines.length - suffixLen);
			if (oldMid.length > 0 || newMid.length > 0) {
				const middleRows = alignMiddle(oldMid, newMid);
				rows.push(...middleRows);
			}
			for (let i = 0; i < suffixLen; i++) {
				const idx = oldLines.length - suffixLen + i;
				rows.push({
					old: {
						text: oldLines[idx],
						type: "same"
					},
					new: {
						text: newLines[idx],
						type: "same"
					}
				});
			}
			return rows;
		}
		//#endregion
		//#region src/client/context-menu.tsx
		/**
		* Dock-git context menu: a small portal-to-<body> popup menu (fixed
		* positioning, `.dg-menu` styles from styles.ts, same idea as dock-files'
		* .df-context-menu). Rendered through a portal so an ancestor transform
		* (dock-mode floating panel) cannot turn the fixed coordinates into
		* panel-relative ones.
		*
		* Closing: outside mousedown, Escape, or any scroll. Each item fires once on
		* click (write operations guard themselves against double-fire separately).
		*/
		/** Menu size estimate used for viewport clamping (the menu is 160-280px wide). */
		const MENU_MAX_WIDTH = 220;
		const MENU_MAX_HEIGHT = 320;
		const EDGE_MARGIN = 4;
		function ContextMenu(props) {
			const { x, y, items, onClose } = props;
			const menuRef = (0, react.useRef)(null);
			const left = Math.max(EDGE_MARGIN, Math.min(x, window.innerWidth - MENU_MAX_WIDTH - EDGE_MARGIN));
			const top = Math.max(EDGE_MARGIN, Math.min(y, window.innerHeight - MENU_MAX_HEIGHT - EDGE_MARGIN));
			(0, react.useEffect)(() => {
				const handleDown = (event) => {
					if (menuRef.current !== null && !menuRef.current.contains(event.target)) onClose();
				};
				const handleKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				const handleScroll = () => onClose();
				document.addEventListener("mousedown", handleDown, true);
				document.addEventListener("keydown", handleKey, true);
				window.addEventListener("scroll", handleScroll, true);
				return () => {
					document.removeEventListener("mousedown", handleDown, true);
					document.removeEventListener("keydown", handleKey, true);
					window.removeEventListener("scroll", handleScroll, true);
				};
			}, [onClose]);
			const nodes = [];
			for (const item of items) {
				if (item.divider === true) {
					nodes.push((0, react.createElement)("div", {
						key: item.key,
						className: "dg-menu-divider"
					}));
					continue;
				}
				const cls = `dg-menu-item${item.danger === true ? " dg-menu-item-danger" : ""}`;
				nodes.push((0, react.createElement)("div", {
					key: item.key,
					className: cls,
					onMouseDown: (event) => {
						event.stopPropagation();
					},
					onClick: () => {
						item.onClick?.();
						onClose();
					}
				}, item.label ?? ""));
			}
			return (0, react_dom.createPortal)((0, react.createElement)("div", {
				className: "dg-menu",
				style: {
					left,
					top
				},
				ref: menuRef,
				onMouseDown: (event) => {
					event.stopPropagation();
				}
			}, ...nodes), document.body);
		}
		//#endregion
		//#region src/client/dialog.tsx
		/**
		* dock-git dock-style modal dialogs: a generic `Dialog` (portal to <body>,
		* overlay + centred panel + title/body/actions) plus small controlled field
		* helpers — `DialogInput`, `DialogSelect`, `DialogCheck` — and a ready-made
		* `PromptDialog` (single text input + OK/Cancel, OK disabled while empty).
		*
		* Rendered through a portal so an ancestor transform (dock-mode floating
		* panel) cannot turn the fixed overlay into panel-relative space — the same
		* reasoning as context-menu.tsx. Closing: Escape, or a mousedown that starts
		* directly on the overlay (a press inside the panel that drags out cannot
		* close it), both call `onCancel`. All strings (labels, buttons) come
		* pre-localized from the caller.
		*/
		/** Dock-style modal: fixed overlay + centred panel, portal to <body>. */
		function Dialog(props) {
			const { open, title, children, okLabel, cancelLabel, onOk, onCancel, okDisabled, width } = props;
			(0, react.useEffect)(() => {
				if (!open) return;
				const handleKey = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						onCancel();
					}
				};
				document.addEventListener("keydown", handleKey, true);
				return () => document.removeEventListener("keydown", handleKey, true);
			}, [open, onCancel]);
			if (!open) return null;
			return (0, react_dom.createPortal)((0, react.createElement)("div", {
				className: "dg-dialog-overlay",
				onMouseDown: (event) => {
					if (event.target === event.currentTarget) onCancel();
				}
			}, (0, react.createElement)("div", {
				className: "dg-dialog",
				style: width !== void 0 ? { width } : void 0,
				onMouseDown: (event) => {
					event.stopPropagation();
				}
			}, (0, react.createElement)("div", { className: "dg-dialog-title" }, title), (0, react.createElement)("div", { className: "dg-dialog-body" }, children), (0, react.createElement)("div", { className: "dg-dialog-actions" }, (0, react.createElement)("button", {
				className: "dg-btn",
				onClick: onCancel
			}, cancelLabel ?? "Cancel"), (0, react.createElement)("button", {
				className: "dg-btn",
				onClick: onOk,
				disabled: okDisabled === true
			}, okLabel ?? "OK")))), document.body);
		}
		function DialogInput(props) {
			const { label, value, onChange, autoFocus, placeholder } = props;
			return (0, react.createElement)("label", { className: "dg-dialog-field" }, (0, react.createElement)("span", { className: "dg-dialog-label" }, label), (0, react.createElement)("input", {
				className: "dg-dialog-input",
				type: "text",
				value,
				placeholder,
				autoFocus: autoFocus === true,
				onChange: (event) => onChange(event.target.value)
			}));
		}
		function DialogSelect(props) {
			const { label, value, options, onChange } = props;
			return (0, react.createElement)("label", { className: "dg-dialog-field" }, (0, react.createElement)("span", { className: "dg-dialog-label" }, label), (0, react.createElement)("select", {
				className: "dg-dialog-select",
				value,
				onChange: (event) => onChange(event.target.value)
			}, options.map((option) => {
				const optionValue = typeof option === "string" ? option : option.value;
				const optionLabel = typeof option === "string" ? option : option.label;
				return (0, react.createElement)("option", {
					key: optionValue,
					value: optionValue
				}, optionLabel);
			})));
		}
		function DialogCheck(props) {
			const { label, checked, onChange } = props;
			return (0, react.createElement)("label", { className: "dg-dialog-check" }, (0, react.createElement)("input", {
				type: "checkbox",
				checked,
				onChange: (event) => onChange(event.target.checked)
			}), label);
		}
		function PromptDialog(props) {
			const { title, label, initialValue, placeholder, okLabel, cancelLabel, onOk, onCancel } = props;
			const [value, setValue] = (0, react.useState)(initialValue ?? "");
			return (0, react.createElement)(Dialog, {
				open: true,
				title,
				okLabel,
				cancelLabel,
				okDisabled: value.trim() === "",
				onOk: () => onOk(value.trim()),
				onCancel
			}, (0, react.createElement)(DialogInput, {
				label,
				value,
				onChange: setValue,
				autoFocus: true,
				placeholder
			}));
		}
		//#endregion
		//#region src/client/wb.ts
		/** POST one /wb-git method; throws on transport/envelope failure. */
		async function postWb(path, body) {
			const response = await fetch(path, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			let json;
			try {
				json = await response.json();
			} catch {
				throw new Error(`${path} returned a malformed response`);
			}
			if (json.ok !== true || json.value === void 0) throw new Error(json.error?.message ?? `${path} failed`);
			return json.value;
		}
		/** Error → string, truncated so the op strip / settings error areas stay readable. */
		function messageOf(cause) {
			const text = cause instanceof Error ? cause.message : String(cause);
			return text.length > 500 ? `${text.slice(0, 500)}…` : text;
		}
		/**
		* Build one /wb-git request body: sessionId + optional repoRoot (omitted when
		* empty, so a workspace-root request never pins an explicit root) + extra
		* fields. Endpoints run git at the session cwd unless repoRoot is present,
		* in which case it is the repository root itself.
		*/
		function wbBody(sessionId, repoRoot, extra) {
			const body = {
				sessionId,
				...extra
			};
			if (repoRoot !== void 0 && repoRoot !== "") body.repoRoot = repoRoot;
			return body;
		}
		//#endregion
		//#region src/client/SettingsView.tsx
		/**
		* Git history settings panel (rendered inside the 'git-history' floating window):
		*
		*  1. Git user — read/save `user.name` / `user.email` via /wb-git/config
		*     (repo-local config; a work tree is required by the host).
		*  2. Remotes — list / add / remove / set-url via /wb-git/remote.
		*  3. Display — date format (localStorage 'dock-git:date-format',
		*     'relative' default) and the current language (read-only: follows the
		*     system locale).
		*
		* All copy goes through the injected `t` (translate bound to the active
		* locale). Failures surface per-section via operationFailed.
		*/
		function SettingsView(props) {
			const { sessionId, repoRoot, locale, t, onBack, dateFormat, onDateFormatChange } = props;
			const [userName, setUserName] = (0, react.useState)("");
			const [userEmail, setUserEmail] = (0, react.useState)("");
			const [userSaving, setUserSaving] = (0, react.useState)(false);
			const [userSaved, setUserSaved] = (0, react.useState)(false);
			const [userError, setUserError] = (0, react.useState)(null);
			const [remotes, setRemotes] = (0, react.useState)([]);
			const [remoteName, setRemoteName] = (0, react.useState)("");
			const [remoteUrl, setRemoteUrl] = (0, react.useState)("");
			const [remoteBusy, setRemoteBusy] = (0, react.useState)(false);
			const [remoteError, setRemoteError] = (0, react.useState)(null);
			/** One open dock-style dialog (set-url prompt / remove confirm). */
			const [dialog, setDialog] = (0, react.useState)(null);
			/** Sequence guard so a stale /wb-git/remote list response cannot overwrite a newer one. */
			const remoteSeq = (0, react.useRef)(0);
			const loadRemotes = (0, react.useCallback)(async () => {
				if (sessionId === void 0) return;
				const seq = ++remoteSeq.current;
				setRemotes([]);
				setRemoteError(null);
				try {
					const value = await postWb("/wb-git/remote", wbBody(sessionId, repoRoot, { action: "list" }));
					if (seq !== remoteSeq.current) return;
					setRemotes(value.remotes);
					setRemoteError(null);
				} catch (cause) {
					if (seq !== remoteSeq.current) return;
					setRemoteError(t("operationFailed", { msg: messageOf(cause) }));
				}
			}, [
				sessionId,
				repoRoot,
				t
			]);
			(0, react.useEffect)(() => {
				let cancelled = false;
				if (sessionId === void 0) return;
				Promise.all([postWb("/wb-git/config", wbBody(sessionId, repoRoot, { key: "user.name" })), postWb("/wb-git/config", wbBody(sessionId, repoRoot, { key: "user.email" }))]).then(([nameValue, emailValue]) => {
					if (cancelled) return;
					setUserName(nameValue.value ?? "");
					setUserEmail(emailValue.value ?? "");
				}).catch(() => {});
				return () => {
					cancelled = true;
				};
			}, [sessionId, repoRoot]);
			(0, react.useEffect)(() => {
				loadRemotes();
			}, [loadRemotes]);
			const saveUser = async () => {
				if (sessionId === void 0 || userSaving) return;
				if (userName.trim() === "" || userEmail.trim() === "") return;
				setUserSaving(true);
				setUserSaved(false);
				setUserError(null);
				try {
					await postWb("/wb-git/config", wbBody(sessionId, repoRoot, {
						key: "user.name",
						value: userName
					}));
					await postWb("/wb-git/config", wbBody(sessionId, repoRoot, {
						key: "user.email",
						value: userEmail
					}));
					setUserSaved(true);
				} catch (cause) {
					setUserError(t("operationFailed", { msg: messageOf(cause) }));
				} finally {
					setUserSaving(false);
				}
			};
			const addRemote = async () => {
				if (sessionId === void 0 || remoteBusy) return;
				const name = remoteName.trim();
				const url = remoteUrl.trim();
				if (name === "" || url === "") return;
				setRemoteBusy(true);
				setRemoteError(null);
				try {
					await postWb("/wb-git/remote", wbBody(sessionId, repoRoot, {
						action: "add",
						name,
						url
					}));
					setRemoteName("");
					setRemoteUrl("");
					await loadRemotes();
				} catch (cause) {
					setRemoteError(t("operationFailed", { msg: messageOf(cause) }));
				} finally {
					setRemoteBusy(false);
				}
			};
			const updateRemoteUrl = async (name, url) => {
				if (sessionId === void 0 || remoteBusy) return;
				const trimmed = url.trim();
				if (trimmed === "") return;
				setRemoteBusy(true);
				setRemoteError(null);
				try {
					await postWb("/wb-git/remote", wbBody(sessionId, repoRoot, {
						action: "set-url",
						name,
						url: trimmed
					}));
					await loadRemotes();
				} catch (cause) {
					setRemoteError(t("operationFailed", { msg: messageOf(cause) }));
				} finally {
					setRemoteBusy(false);
				}
			};
			const removeRemote = async (name) => {
				if (sessionId === void 0 || remoteBusy) return;
				setRemoteBusy(true);
				setRemoteError(null);
				try {
					await postWb("/wb-git/remote", wbBody(sessionId, repoRoot, {
						action: "remove",
						name
					}));
					await loadRemotes();
				} catch (cause) {
					setRemoteError(t("operationFailed", { msg: messageOf(cause) }));
				} finally {
					setRemoteBusy(false);
				}
			};
			const onInput = (setter) => (event) => setter(event.target.value);
			const localeLabel = locale === "zh" ? "中文" : "English";
			return (0, react.createElement)("div", { className: "dg-settings" }, (0, react.createElement)("div", { className: "dg-settings-section" }, (0, react.createElement)("div", { className: "dg-settings-section-title" }, t("gitUserSection")), (0, react.createElement)("div", { className: "dg-settings-row" }, (0, react.createElement)("span", { className: "dg-settings-label" }, t("userNameLabel")), (0, react.createElement)("input", {
				className: "dg-settings-input",
				value: userName,
				placeholder: t("userNameLabel"),
				onChange: onInput(setUserName)
			})), (0, react.createElement)("div", { className: "dg-settings-row" }, (0, react.createElement)("span", { className: "dg-settings-label" }, t("userEmailLabel")), (0, react.createElement)("input", {
				className: "dg-settings-input",
				value: userEmail,
				placeholder: t("userEmailLabel"),
				onChange: onInput(setUserEmail)
			})), (0, react.createElement)("div", { className: "dg-settings-row" }, (0, react.createElement)("button", {
				className: "dg-btn",
				onClick: () => void saveUser(),
				disabled: userSaving || userName.trim() === "" || userEmail.trim() === ""
			}, t("save")), userSaved ? (0, react.createElement)("span", { className: "dg-saved" }, t("saved")) : null), userError !== null ? (0, react.createElement)("div", { className: "dg-op-error" }, userError) : null), (0, react.createElement)("div", { className: "dg-settings-section" }, (0, react.createElement)("div", { className: "dg-settings-section-title" }, t("remotesSection")), (0, react.createElement)("div", { className: "dg-settings-row" }, (0, react.createElement)("input", {
				className: "dg-settings-input dg-settings-remote-name-input",
				value: remoteName,
				placeholder: t("remoteNamePlaceholder"),
				onChange: onInput(setRemoteName)
			}), (0, react.createElement)("input", {
				className: "dg-settings-input",
				value: remoteUrl,
				placeholder: t("remoteUrlPlaceholder"),
				onChange: onInput(setRemoteUrl)
			}), (0, react.createElement)("button", {
				className: "dg-btn",
				onClick: () => void addRemote(),
				disabled: remoteBusy
			}, t("addRemote"))), remotes.length === 0 ? (0, react.createElement)("div", { className: "dg-muted dg-settings-empty" }, t("emptyRemotes")) : (0, react.createElement)("div", null, remotes.map((remote) => (0, react.createElement)("div", {
				key: remote.name,
				className: "dg-settings-remote"
			}, (0, react.createElement)("span", {
				className: "dg-settings-remote-name",
				title: remote.name
			}, remote.name), (0, react.createElement)("span", {
				className: "dg-settings-remote-url",
				title: remote.url
			}, remote.url), (0, react.createElement)("button", {
				className: "dg-btn",
				onClick: () => setDialog({
					kind: "set-url",
					name: remote.name
				}),
				disabled: remoteBusy
			}, t("updateUrl")), (0, react.createElement)("button", {
				className: "dg-btn dg-btn-danger",
				onClick: () => setDialog({
					kind: "remove",
					name: remote.name
				}),
				disabled: remoteBusy
			}, t("removeRemote"))))), remoteError !== null ? (0, react.createElement)("div", { className: "dg-op-error" }, remoteError) : null), (0, react.createElement)("div", { className: "dg-settings-section" }, (0, react.createElement)("div", { className: "dg-settings-section-title" }, t("displaySection")), (0, react.createElement)("div", { className: "dg-settings-row" }, (0, react.createElement)("span", { className: "dg-settings-label" }, t("dateFormatLabel")), (0, react.createElement)("label", { className: "dg-settings-radio" }, (0, react.createElement)("input", {
				type: "radio",
				name: "dg-date-format",
				checked: dateFormat === "relative",
				onChange: () => onDateFormatChange("relative")
			}), t("dateRelative")), (0, react.createElement)("label", { className: "dg-settings-radio" }, (0, react.createElement)("input", {
				type: "radio",
				name: "dg-date-format",
				checked: dateFormat === "absolute",
				onChange: () => onDateFormatChange("absolute")
			}), t("dateAbsolute"))), (0, react.createElement)("div", { className: "dg-settings-row" }, (0, react.createElement)("span", { className: "dg-settings-label" }, t("languageLabel")), (0, react.createElement)("span", { className: "dg-settings-lang" }, `${t("followSystem")}(${localeLabel})`))), (0, react.createElement)("div", { className: "dg-settings-back" }, (0, react.createElement)("button", {
				className: "dg-btn",
				onClick: onBack
			}, t("backToGraph"))), dialog !== null && dialog.kind === "set-url" ? (0, react.createElement)(PromptDialog, {
				key: "set-url",
				title: t("updateUrl"),
				label: t("promptSetUrl"),
				okLabel: t("dialogOk"),
				cancelLabel: t("dialogCancel"),
				onOk: (url) => {
					setDialog(null);
					updateRemoteUrl(dialog.name, url);
				},
				onCancel: () => setDialog(null)
			}) : null, dialog !== null && dialog.kind === "remove" ? (0, react.createElement)(Dialog, {
				key: "remove",
				open: true,
				title: t("removeRemote"),
				okLabel: t("dialogOk"),
				cancelLabel: t("dialogCancel"),
				onOk: () => {
					setDialog(null);
					removeRemote(dialog.name);
				},
				onCancel: () => setDialog(null)
			}, (0, react.createElement)("div", null, t("confirmRemoveRemote", { name: dialog.name }))) : null);
		}
		//#endregion
		//#region src/client/swimlane.ts
		const GRID = {
			x: 16,
			y: 24,
			offsetX: 16,
			offsetY: 12
		};
		/**
		* Lane palette, indexed by a row/line `colourIndex`. The engine recycles
		* colours whose lanes have ended, so the palette never needs to be larger
		* than the number of simultaneously live lanes; the index wraps defensively.
		*/
		const COLOURS = [
			"#d1242f",
			"#0969da",
			"#1a7f37",
			"#8250df",
			"#bf8700",
			"#cf222e",
			"#0550ae",
			"#116329",
			"#6639ba",
			"#9a6700",
			"#e16f24",
			"#6e7781"
		];
		/**
		* Lay out `commits` (index 0 = top/newest row; the array may start with the
		* uncommitted pseudo-row whose hash is `*`, and may be empty) into a swimlane
		* graph model. `headHash` marks the current row; `options` inserts extra
		* vertical space under one row (see `applyExpandToLines`).
		*/
		function layoutGraph(commits, headHash, options) {
			const rows = [];
			const lines = [];
			const lanes = [];
			const freeColumns = [];
			const freeColours = [];
			let nextColumn = 0;
			let nextColour = 0;
			/** The lowest free column, or a fresh one past the current high-water mark. */
			const takeColumn = () => {
				if (freeColumns.length > 0) return freeColumns.shift();
				const column = nextColumn;
				nextColumn += 1;
				return column;
			};
			/** A recycled colour, or the next palette index (wrapped defensively). */
			const takeColour = () => {
				if (freeColours.length > 0) return freeColours.shift();
				const colour = nextColour % COLOURS.length;
				nextColour += 1;
				return colour;
			};
			const releaseColumn = (column) => {
				freeColumns.push(column);
				freeColumns.sort((a, b) => a - b);
			};
			const releaseColour = (colour) => {
				if (!freeColours.includes(colour)) freeColours.push(colour);
			};
			const emitLine = (fromCol, fromRow, toCol, toRow, colourIndex, committed) => {
				lines.push({
					p1: {
						x: fromCol,
						y: fromRow
					},
					p2: {
						x: toCol,
						y: toRow
					},
					colourIndex,
					isCommitted: committed
				});
			};
			for (let id = 0; id < commits.length; id++) {
				const commit = commits[id];
				const isPseudo = commit.hash === "*";
				let column;
				let colourIndex;
				let committed;
				let claimed = -1;
				for (let i = 0; i < lanes.length; i++) if (lanes[i].tip === commit.hash && (claimed === -1 || lanes[i].column < lanes[claimed].column)) claimed = i;
				if (claimed >= 0) {
					const lane = lanes[claimed];
					lanes.splice(claimed, 1);
					column = lane.column;
					colourIndex = lane.colourIndex;
					committed = lane.committed;
					emitLine(lane.fromCol, lane.fromRow, column, id, colourIndex, committed);
					for (const r of lane.reuses) if (r.col !== column) emitLine(r.col, r.row, column, r.row + 1, colourIndex, committed);
					for (let other = lanes.length - 1; other >= 0; other--) if (lanes[other].tip === commit.hash) {
						const otherLane = lanes[other];
						if (id > 0) {
							const span = Math.max(1, Math.min(2, Math.ceil(Math.abs(column - otherLane.column) / 2)));
							const maxReuseArrival = otherLane.reuses.reduce((m, r) => Math.max(m, r.row + 1), 0);
							const turnRow = Math.min(id - 1, Math.max(otherLane.fromRow + 1, id - span, maxReuseArrival));
							emitLine(otherLane.fromCol, otherLane.fromRow, otherLane.column, turnRow, otherLane.colourIndex, otherLane.committed);
							for (const r of otherLane.reuses) {
								if (r.col === otherLane.column) continue;
								if (r.row + 1 <= turnRow) emitLine(r.col, r.row, otherLane.column, r.row + 1, otherLane.colourIndex, otherLane.committed);
								else emitLine(r.col, r.row, column, id, otherLane.colourIndex, otherLane.committed);
							}
							if (otherLane.column !== column) emitLine(otherLane.column, turnRow, column, id, otherLane.colourIndex, otherLane.committed);
						} else {
							emitLine(otherLane.fromCol, otherLane.fromRow, otherLane.column, id, otherLane.colourIndex, otherLane.committed);
							if (otherLane.column !== column) emitLine(otherLane.column, id, column, id, otherLane.colourIndex, otherLane.committed);
						}
						releaseColumn(otherLane.column);
						releaseColour(otherLane.colourIndex);
						lanes.splice(other, 1);
					}
				} else {
					column = takeColumn();
					colourIndex = takeColour();
					committed = !isPseudo;
				}
				rows.push({
					id,
					x: column,
					colourIndex,
					isCurrent: commit.hash === headHash,
					isCommitted: !isPseudo
				});
				if (commit.parents.length > 0) {
					lanes.push({
						column,
						colourIndex,
						tip: commit.parents[0],
						fromRow: id,
						fromCol: column,
						committed: !isPseudo,
						reuses: []
					});
					for (let p = 1; p < commit.parents.length; p++) {
						const parent = commit.parents[p];
						const existing = lanes.findIndex((l) => l.tip === parent);
						if (existing >= 0) {
							const lane = lanes[existing];
							if (lane.column !== column) lane.reuses.push({
								col: column,
								row: id
							});
						} else {
							const extraColumn = takeColumn();
							const extraColour = takeColour();
							if (extraColumn !== column) emitLine(column, id, extraColumn, id + 1, extraColour, !isPseudo);
							lanes.push({
								column: extraColumn,
								colourIndex: extraColour,
								tip: parent,
								fromRow: id + 1,
								fromCol: extraColumn,
								committed: !isPseudo,
								reuses: []
							});
						}
					}
				} else {
					releaseColumn(column);
					releaseColour(colourIndex);
				}
			}
			const bottom = commits.length;
			for (const lane of lanes) {
				emitLine(lane.fromCol, lane.fromRow, lane.column, bottom, lane.colourIndex, lane.committed);
				for (const r of lane.reuses) if (r.col !== lane.column) emitLine(r.col, r.row, lane.column, r.row + 1, lane.colourIndex, lane.committed);
			}
			let maxColumn = 0;
			for (const row of rows) maxColumn = Math.max(maxColumn, row.x);
			for (const line of lines) maxColumn = Math.max(maxColumn, line.p1.x, line.p2.x);
			const width = 2 * GRID.offsetX + maxColumn * GRID.x;
			let height = commits.length * GRID.y + 2 * GRID.offsetY;
			let resultLines = lines;
			if (options !== void 0) {
				resultLines = applyExpandToLines(lines, options);
				height += options.height;
			}
			return {
				rows,
				lines: resultLines,
				width,
				height
			};
		}
		/**
		* Apply the inline-expansion split to a line array produced without
		* expansion, returning a new array (the input is never mutated).
		*
		* The strip is inserted under row `index`, so everything at or below the
		* strip moves down by `height` px. A line that crosses the band (starts at or
		* above row `index` and ends at or below row `index + 1`) is split into three
		* segments — an approach ending at the upper boundary of the band, a vertical
		* bridge straight through the band (so the lane stays visually continuous
		* behind the expanded panel), and a continuation resuming at the lower
		* boundary — preserving colour and committed flag; a line entirely below the
		* band is shifted down as a whole. All resulting coordinates are
		* non-negative; a zero-length continuation (the line already ended at the
		* band's lower boundary) is dropped.
		*/
		function applyExpandToLines(lines, options) {
			const { index, height } = options;
			const shift = height / GRID.y;
			const bandTop = index + 1;
			const bandBottom = bandTop + shift;
			const out = [];
			for (const line of lines) if (line.p1.y <= index && line.p2.y >= bandTop) {
				out.push({
					p1: line.p1,
					p2: {
						x: line.p2.x,
						y: bandTop
					},
					colourIndex: line.colourIndex,
					isCommitted: line.isCommitted
				});
				out.push({
					p1: {
						x: line.p2.x,
						y: bandTop
					},
					p2: {
						x: line.p2.x,
						y: bandBottom
					},
					colourIndex: line.colourIndex,
					isCommitted: line.isCommitted
				});
				const resumedY = line.p2.y + shift;
				if (resumedY > bandBottom) out.push({
					p1: {
						x: line.p2.x,
						y: bandBottom
					},
					p2: {
						x: line.p2.x,
						y: resumedY
					},
					colourIndex: line.colourIndex,
					isCommitted: line.isCommitted
				});
			} else if (line.p1.y > index) out.push({
				p1: {
					x: line.p1.x,
					y: line.p1.y + shift
				},
				p2: {
					x: line.p2.x,
					y: line.p2.y + shift
				},
				colourIndex: line.colourIndex,
				isCommitted: line.isCommitted
			});
			else out.push(line);
			return out;
		}
		//#endregion
		//#region src/client/CommitView.tsx
		/**
		* CommitView — the main commit-list view of dock-git: the editor view the
		* client entry registers under the 'git-history' id, hosted in an independent
		* floating window that the launcher opens. It renders the repository's commit
		* history as a swimlane graph (src/client/swimlane.ts) with an interactive
		* row list, inline commit metadata, a bottom-docked three-column detail panel,
		* a working-tree change panel, context menus, dialogs and a settings panel.
		*
		* Conventions follow the other client view modules (GitLauncher /
		* SettingsView): element creation via React.createElement, the `useLocale`
		* hook + bound `t` for every visible string (the dictionary already contains
		* every key used here), and the /wb-git wire helpers from wb.ts with the
		* repoRoot read from the open seed (`seed.meta.repoRoot`).
		*/
		/** Height of the inline expansion strip (px): the graph band inserted under
		*  an expanded row must match the DOM strip exactly, so it is one constant. */
		const INLINE_META_HEIGHT = 192;
		/** Initial commit window; "load more" grows it by this amount. */
		const LOAD_MORE_STEP = 200;
		/** Diff line cap (the diff module's own default; rows beyond it are dropped). */
		const MAX_DIFF_LINES = 5e3;
		function shortHash(hash) {
			return hash.length > 8 ? hash.slice(0, 8) : hash;
		}
		function absoluteDate(date) {
			const d = /* @__PURE__ */ new Date(date * 1e3);
			const pad = (n) => String(n).padStart(2, "0");
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		}
		/** Relative date from the dictionary (justNow / minutesAgo / hoursAgo);
		*  anything older falls back to the locale-neutral absolute date. */
		function relativeDate(date, now, t) {
			const diff = Math.max(0, now - date);
			if (diff < 60) return t("justNow");
			if (diff < 3600) return t("minutesAgo", { n: Math.floor(diff / 60) });
			if (diff < 86400) return t("hoursAgo", { n: Math.floor(diff / 3600) });
			return absoluteDate(date);
		}
		function formatDate(date, now, format, t) {
			return format === "absolute" ? absoluteDate(date) : relativeDate(date, now, t);
		}
		/** Stable colour for a ref (local branch, remote branch or tag) derived from
		*  its name: the same ref always gets the same palette colour (consistent
		*  across commits and sessions), and distinct refs spread across the palette.
		*  The lane colours the graph lines use are separate — the badge colour
		*  identifies the ref itself, not the commit it sits on. */
		function refColour(name) {
			let h = 2166136261;
			for (let i = 0; i < name.length; i++) {
				h ^= name.charCodeAt(i);
				h = Math.imul(h, 16777619);
			}
			return COLOURS[(h >>> 0) % COLOURS.length];
		}
		/** Lucide-style icon paths per ref kind, drawn with currentColor so the icon
		*  inherits the badge's tint. Gives branches, remotes and tags distinct
		*  shapes even when several sit on the same commit. */
		const REF_ICON = {
			head: ["M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9"],
			remote: ["M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"],
			tag: ["M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z", "M7 7h.01"]
		};
		function refIcon(kind) {
			return (0, react.createElement)("svg", {
				className: "dg-ref-icon",
				width: 11,
				height: 11,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2.2,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true
			}, REF_ICON[kind].map((d, i) => (0, react.createElement)("path", {
				key: i,
				d
			})));
		}
		/** Group the changed files of a commit by directory ('' = repository root). */
		function groupFiles(files) {
			const byDir = /* @__PURE__ */ new Map();
			for (const file of files) {
				const idx = file.path.lastIndexOf("/");
				const dir = idx >= 0 ? file.path.slice(0, idx) : "";
				const list = byDir.get(dir);
				if (list === void 0) byDir.set(dir, [file]);
				else list.push(file);
			}
			return [...byDir.entries()].sort((a, b) => a[0] === "" ? -1 : b[0] === "" ? 1 : a[0] < b[0] ? -1 : 1).map(([dir, list]) => ({
				dir,
				files: list
			}));
		}
		/** Classify one raw unified-diff line for colouring. File-header lines are
		*  checked before the generic +/- so `--- a/x` / `+++ b/x` are not mistaken
		*  for additions/deletions. */
		function rawDiffLineClass(line) {
			if (line.startsWith("--- ") || line.startsWith("+++ ")) return "dg-diff-line dg-diff-hdr";
			if (line.startsWith("@@")) return "dg-diff-line dg-diff-hunk";
			if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("new file") || line.startsWith("deleted file") || line.startsWith("Binary files")) return "dg-diff-line dg-diff-hdr";
			if (line.startsWith("+")) return "dg-diff-line dg-diff-add";
			if (line.startsWith("-")) return "dg-diff-line dg-diff-del";
			return "dg-diff-line dg-diff-same";
		}
		function CommitView(props) {
			const { ctx, sessionId, active, seed } = props;
			const seedMeta = seed?.meta;
			const repoRoot = typeof seedMeta?.repoRoot === "string" && seedMeta.repoRoot !== "" ? seedMeta.repoRoot : void 0;
			const seedTitle = seed?.title;
			const locale = useLocale(ctx);
			const t = (0, react.useCallback)((key, params) => translate(locale, key, params), [locale]);
			const body = (0, react.useCallback)((extra) => wbBody(sessionId, repoRoot, extra), [sessionId, repoRoot]);
			const [mode, setMode] = (0, react.useState)("graph");
			const [dateFormat, setDateFormat] = (0, react.useState)(() => {
				try {
					return localStorage.getItem("dock-git:date-format") === "absolute" ? "absolute" : "relative";
				} catch {
					return "relative";
				}
			});
			const handleDateFormatChange = (format) => {
				setDateFormat(format);
				try {
					localStorage.setItem("dock-git:date-format", format);
				} catch {}
			};
			const [isRepo, setIsRepo] = (0, react.useState)(null);
			const [root, setRoot] = (0, react.useState)(null);
			const [branch, setBranch] = (0, react.useState)(null);
			const [commits, setCommits] = (0, react.useState)([]);
			const [more, setMore] = (0, react.useState)(false);
			const [head, setHead] = (0, react.useState)(null);
			const [maxCommits, setMaxCommits] = (0, react.useState)(LOAD_MORE_STEP);
			const [branchFilter, setBranchFilter] = (0, react.useState)(null);
			const [showRemote, setShowRemote] = (0, react.useState)(false);
			const [loading, setLoading] = (0, react.useState)(false);
			const [loadError, setLoadError] = (0, react.useState)(null);
			const [branches, setBranches] = (0, react.useState)([]);
			const [reloadTick, setReloadTick] = (0, react.useState)(0);
			const [selectedId, setSelectedId] = (0, react.useState)(null);
			const [expandedId, setExpandedId] = (0, react.useState)(null);
			const [detail, setDetail] = (0, react.useState)(null);
			const [detailLoading, setDetailLoading] = (0, react.useState)(false);
			const [detailError, setDetailError] = (0, react.useState)(null);
			const [detailRetryTick, setDetailRetryTick] = (0, react.useState)(0);
			const [panelOpen, setPanelOpen] = (0, react.useState)(false);
			const [panelHash, setPanelHash] = (0, react.useState)(null);
			const [panelDetail, setPanelDetail] = (0, react.useState)(null);
			const [panelMode, setPanelMode] = (0, react.useState)("files");
			const [panelHeight, setPanelHeight] = (0, react.useState)(240);
			const [selectedFile, setSelectedFile] = (0, react.useState)(null);
			const [oldContent, setOldContent] = (0, react.useState)(null);
			const [newContent, setNewContent] = (0, react.useState)(null);
			const [contentLoading, setContentLoading] = (0, react.useState)(false);
			const [collapsedDirs, setCollapsedDirs] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [commitPanelOpen, setCommitPanelOpen] = (0, react.useState)(false);
			const [statusFiles, setStatusFiles] = (0, react.useState)([]);
			const [commitMsg, setCommitMsg] = (0, react.useState)("");
			const [commitError, setCommitError] = (0, react.useState)(null);
			const [opMsg, setOpMsg] = (0, react.useState)(null);
			const [opError, setOpError] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const busyRef = (0, react.useRef)(false);
			const [menu, setMenu] = (0, react.useState)(null);
			const [dialog, setDialog] = (0, react.useState)(null);
			const [pushForm, setPushForm] = (0, react.useState)({
				remote: "origin",
				setUpstream: true,
				mode: "normal"
			});
			const [remotes, setRemotes] = (0, react.useState)([]);
			const logSeq = (0, react.useRef)(0);
			const branchesSeq = (0, react.useRef)(0);
			const statusSeq = (0, react.useRef)(0);
			const detailSeq = (0, react.useRef)(0);
			const panelDetailSeq = (0, react.useRef)(0);
			const contentSeq = (0, react.useRef)(0);
			const rowsRef = (0, react.useRef)(null);
			const restoreScroll = (0, react.useRef)(null);
			const oldPaneRef = (0, react.useRef)(null);
			const newPaneRef = (0, react.useRef)(null);
			/** Reset everything tied to the current repository/session. */
			const resetData = (0, react.useCallback)(() => {
				setIsRepo(null);
				setRoot(null);
				setBranch(null);
				setCommits([]);
				setMore(false);
				setHead(null);
				setLoading(false);
				setLoadError(null);
				setBranches([]);
				setSelectedId(null);
				setExpandedId(null);
				setDetail(null);
				setDetailError(null);
				setPanelOpen(false);
				setPanelHash(null);
				setPanelDetail(null);
				setSelectedFile(null);
				setOldContent(null);
				setNewContent(null);
				setStatusFiles([]);
				setCommitError(null);
				setOpMsg(null);
				setOpError(null);
			}, []);
			const repoKey = `${sessionId ?? ""}\u0000${repoRoot ?? ""}`;
			(0, react.useEffect)(() => {
				resetData();
			}, [repoKey, resetData]);
			(0, react.useEffect)(() => {
				if (!active || sessionId === void 0) return;
				const seq = ++logSeq.current;
				let cancelled = false;
				setLoading(true);
				setLoadError(null);
				postWb("/wb-git/log", body({
					maxCommits,
					...branchFilter !== null ? { branches: [branchFilter] } : {},
					showRemote
				})).then((value) => {
					if (cancelled || seq !== logSeq.current) return;
					const previousHash = expandedId !== null ? commits[expandedId]?.hash : void 0;
					setLoading(false);
					setIsRepo(value.isRepo);
					setRoot(value.root);
					setBranch(value.branch);
					setCommits(value.commits);
					setMore(value.more);
					setHead(value.head);
					if (previousHash !== void 0) {
						const idx = value.commits.findIndex((c) => c.hash === previousHash);
						setExpandedId(idx >= 0 ? idx : null);
					}
				}).catch((cause) => {
					if (cancelled || seq !== logSeq.current) return;
					setLoading(false);
					setLoadError(messageOf(cause));
				});
				return () => {
					cancelled = true;
				};
			}, [
				active,
				repoKey,
				branchFilter,
				showRemote,
				maxCommits,
				reloadTick,
				body
			]);
			(0, react.useEffect)(() => {
				if (!active || sessionId === void 0) return;
				const seq = ++branchesSeq.current;
				let cancelled = false;
				postWb("/wb-git/branches", body({ showRemote })).then((value) => {
					if (cancelled || seq !== branchesSeq.current) return;
					setBranches(value.branches);
				}).catch(() => {});
				return () => {
					cancelled = true;
				};
			}, [
				active,
				repoKey,
				showRemote,
				reloadTick,
				body
			]);
			(0, react.useEffect)(() => {
				if (!active || sessionId === void 0) return;
				const seq = ++statusSeq.current;
				let cancelled = false;
				postWb("/wb-git/status-files", body()).then((value) => {
					if (cancelled || seq !== statusSeq.current) return;
					setStatusFiles(value.files);
				}).catch(() => {
					setStatusFiles([]);
				});
				return () => {
					cancelled = true;
				};
			}, [
				active,
				repoKey,
				reloadTick,
				body
			]);
			(0, react.useEffect)(() => {
				if (expandedId === null || sessionId === void 0 || commits[expandedId] === void 0) {
					setDetail(null);
					setDetailError(null);
					setDetailLoading(false);
					return;
				}
				const hash = commits[expandedId].hash;
				if (hash === "*") {
					setDetail(null);
					setDetailError(null);
					setDetailLoading(false);
					return;
				}
				const seq = ++detailSeq.current;
				let cancelled = false;
				setDetailLoading(true);
				setDetailError(null);
				postWb("/wb-git/detail", body({ hash })).then((value) => {
					if (cancelled || seq !== detailSeq.current) return;
					setDetail(value);
					setDetailLoading(false);
				}).catch((cause) => {
					if (cancelled || seq !== detailSeq.current) return;
					setDetailError(messageOf(cause));
					setDetailLoading(false);
				});
				return () => {
					cancelled = true;
				};
			}, [
				expandedId,
				sessionId,
				body,
				commits,
				detailRetryTick
			]);
			(0, react.useEffect)(() => {
				if (panelHash === null || sessionId === void 0) {
					setPanelDetail(null);
					setSelectedFile(null);
					setOldContent(null);
					setNewContent(null);
					return;
				}
				const seq = ++panelDetailSeq.current;
				let cancelled = false;
				postWb("/wb-git/detail", body({ hash: panelHash })).then((value) => {
					if (cancelled || seq !== panelDetailSeq.current) return;
					setPanelDetail(value);
					setSelectedFile(value.files.length > 0 ? value.files[0].path : null);
					setOldContent(null);
					setNewContent(null);
				}).catch(() => {
					setPanelDetail(null);
				});
				return () => {
					cancelled = true;
				};
			}, [
				panelHash,
				sessionId,
				body
			]);
			(0, react.useEffect)(() => {
				if (panelHash === null || selectedFile === null || sessionId === void 0) {
					setOldContent(null);
					setNewContent(null);
					setContentLoading(false);
					return;
				}
				const seq = ++contentSeq.current;
				let cancelled = false;
				setContentLoading(true);
				Promise.all([postWb("/wb-git/file-content", body({
					hash: panelHash,
					path: selectedFile,
					side: "old"
				})), postWb("/wb-git/file-content", body({
					hash: panelHash,
					path: selectedFile,
					side: "new"
				}))]).then(([oldValue, newValue]) => {
					if (cancelled || seq !== contentSeq.current) return;
					setOldContent(oldValue);
					setNewContent(newValue);
					setContentLoading(false);
				}).catch(() => {
					if (cancelled || seq !== contentSeq.current) return;
					setOldContent(null);
					setNewContent(null);
					setContentLoading(false);
				});
				return () => {
					cancelled = true;
				};
			}, [
				panelHash,
				selectedFile,
				sessionId,
				body
			]);
			(0, react.useEffect)(() => {
				if (restoreScroll.current !== null && rowsRef.current !== null) {
					rowsRef.current.scrollTop = restoreScroll.current;
					restoreScroll.current = null;
				}
			}, [commits]);
			/** Run one mutating /wb-git operation under the busy guard; returns true on
			*  success. `summary` (localized) is shown on the result strip on success;
			*  `onError` receives the localized failure message (e.g. for a
			*  panel-local error area). */
			const runWrite = (0, react.useCallback)(async (summary, fn, onError) => {
				if (busyRef.current) {
					setOpError(t("operationBusy"));
					return false;
				}
				busyRef.current = true;
				setBusy(true);
				setOpMsg(null);
				setOpError(null);
				try {
					await fn();
					if (summary !== null) setOpMsg(summary);
					return true;
				} catch (cause) {
					const message = t("operationFailed", { msg: messageOf(cause) });
					setOpError(message);
					onError?.(message);
					return false;
				} finally {
					busyRef.current = false;
					setBusy(false);
				}
			}, [t]);
			/** After a successful write: reload the log, the branches and the files. */
			const refresh = (0, react.useCallback)(() => {
				setReloadTick((n) => n + 1);
			}, []);
			const reloadStatus = (0, react.useCallback)(() => {
				if (sessionId === void 0) return;
				const seq = ++statusSeq.current;
				postWb("/wb-git/status-files", body()).then((value) => {
					if (seq !== statusSeq.current) return;
					setStatusFiles(value.files);
				}).catch(() => {});
			}, [sessionId, body]);
			/** Clicking a row selects it, toggles its inline expansion (the uncommitted
			*  pseudo-row can be selected but never expanded) and opens the bottom
			*  detail panel for that commit. */
			const toggleRow = (0, react.useCallback)((rowId) => {
				setSelectedId(rowId);
				const isPseudo = commits[rowId]?.hash === "*";
				if (!isPseudo) setExpandedId((current) => current === rowId ? null : rowId);
				const commit = commits[rowId];
				if (commit !== void 0 && !isPseudo) {
					setPanelOpen(true);
					setPanelHash(commit.hash);
				}
			}, [commits]);
			/** Select + expand the commit with the given hash (parent links), and open
			*  its bottom detail panel. */
			const selectByHash = (0, react.useCallback)((hash) => {
				const id = commits.findIndex((c) => c.hash === hash);
				if (id >= 0) {
					setSelectedId(id);
					setExpandedId(id);
					setPanelOpen(true);
					setPanelHash(hash);
				}
			}, [commits]);
			const layout = (0, react.useMemo)(() => {
				const input = commits.map((c) => ({
					hash: c.hash,
					parents: c.parents
				}));
				const options = expandedId !== null && commits[expandedId]?.hash !== "*" ? {
					index: expandedId,
					height: INLINE_META_HEIGHT
				} : void 0;
				return layoutGraph(input, head, options);
			}, [
				commits,
				head,
				expandedId
			]);
			const toPx = (0, react.useCallback)((p) => ({
				x: p.x * GRID.x + GRID.offsetX,
				y: p.y * GRID.y + GRID.offsetY
			}), []);
			/** Dot position of one layout row; rows below the expanded band shift down
			*  by the strip height exactly like the DOM rows do. */
			const dotPosition = (0, react.useCallback)((row) => {
				const shift = expandedId !== null && row.id > expandedId ? INLINE_META_HEIGHT / GRID.y : 0;
				return {
					x: row.x * GRID.x + GRID.offsetX,
					y: (row.id + shift) * GRID.y + GRID.offsetY
				};
			}, [expandedId]);
			/** Same SVG path building as the preview script: consecutive segments with
			*  the same colour/committed state and a shared start point merge into one
			*  path. Lane changes are gentle same-row S-curves (the layout never emits
			*  long diagonals); vertical lanes are straight lines. */
			const buildSvgPaths = (0, react.useCallback)((lines) => {
				const paths = [];
				let d = "";
				let curColour = -1;
				let curCommitted = false;
				let started = false;
				let lastX = 0;
				let lastY = 0;
				const flush = () => {
					if (d !== "") {
						paths.push({
							d,
							isCommitted: curCommitted,
							colourIndex: curColour
						});
						d = "";
						started = false;
					}
				};
				for (const line of lines) {
					const p1 = toPx(line.p1);
					const p2 = toPx(line.p2);
					if (!started || curColour !== line.colourIndex || curCommitted !== line.isCommitted || lastX !== p1.x || lastY !== p1.y) {
						flush();
						d += `M${p1.x.toFixed(0)},${p1.y.toFixed(1)}`;
						curColour = line.colourIndex;
						curCommitted = line.isCommitted;
						started = true;
					}
					if (p1.x === p2.x) d += `L${p2.x.toFixed(0)},${p2.y.toFixed(1)}`;
					else if (p1.y === p2.y) {
						const m = GRID.y * .4;
						d += `C${p1.x.toFixed(0)},${(p1.y + m).toFixed(1)} ${p2.x.toFixed(0)},${(p2.y - m).toFixed(1)} ${p2.x.toFixed(0)},${p2.y.toFixed(1)}`;
					} else {
						const mid = GRID.y * .75;
						d += `C${p1.x.toFixed(0)},${(p1.y + mid).toFixed(1)} ${p2.x.toFixed(0)},${(p2.y - mid).toFixed(1)} ${p2.x.toFixed(0)},${p2.y.toFixed(1)}`;
					}
					lastX = p2.x;
					lastY = p2.y;
				}
				flush();
				return paths;
			}, [toPx]);
			const svgPaths = (0, react.useMemo)(() => buildSvgPaths(layout.lines), [layout.lines, buildSvgPaths]);
			const repoName = (0, react.useMemo)(() => {
				return (root !== null ? root.split("/").pop() : repoRoot !== void 0 ? repoRoot.split("/").pop() : void 0) ?? (typeof seedTitle === "string" ? seedTitle : "");
			}, [
				root,
				repoRoot,
				seedTitle
			]);
			const onLoadMore = (0, react.useCallback)(() => {
				if (rowsRef.current !== null) restoreScroll.current = rowsRef.current.scrollTop;
				setMaxCommits((n) => n + LOAD_MORE_STEP);
			}, []);
			const onRefresh = (0, react.useCallback)(() => {
				setOpMsg(null);
				setOpError(null);
				refresh();
			}, [refresh]);
			const onFetch = (0, react.useCallback)(() => {
				runWrite(t("fetchDone"), async () => {
					await postWb("/wb-git/fetch", body({}));
				}).then((ok) => {
					if (ok) refresh();
				});
			}, [
				runWrite,
				t,
				body,
				refresh
			]);
			const copyText = (0, react.useCallback)((text) => {
				navigator.clipboard.writeText(text).catch(() => {});
			}, []);
			/**
			* Copy the FULL commit message. The log record (`GitLogCommit`) only carries
			* the subject, so fetch the commit detail and copy its `meta.body` (the full
			* message). The fetch is self-contained per click — no shared state, so no
			* sequence guard is needed; on failure or an empty body, fall back to the
			* subject and surface the problem on the result strip like other failures.
			*/
			const copyCommitBody = (0, react.useCallback)((hash, subject) => {
				if (sessionId === void 0) {
					copyText(subject);
					return;
				}
				postWb("/wb-git/detail", body({ hash })).then((value) => {
					if (value.meta.body !== "") copyText(value.meta.body);
					else {
						copyText(subject);
						setOpError(t("operationFailed", { msg: "commit body is empty" }));
					}
				}).catch((cause) => {
					copyText(subject);
					setOpError(t("operationFailed", { msg: messageOf(cause) }));
				});
			}, [
				sessionId,
				body,
				t,
				copyText
			]);
			const openMenu = (0, react.useCallback)((event, items) => {
				event.preventDefault();
				event.stopPropagation();
				setMenu({
					x: event.clientX,
					y: event.clientY,
					items
				});
			}, []);
			/** Commit-row context menu (with branch actions when the commit carries a
			*  local branch). */
			const openCommitMenu = (0, react.useCallback)((event, rowId) => {
				const commit = commits[rowId];
				if (commit === void 0) return;
				const items = [
					{
						key: "copy-hash",
						label: t("copyCommitHash"),
						onClick: () => copyText(commit.hash)
					},
					{
						key: "copy-subject",
						label: t("copyCommitSubject"),
						onClick: () => copyText(commit.message)
					},
					...commit.hash !== "*" ? [
						{
							key: "copy-body",
							label: t("copyCommitBody"),
							onClick: () => copyCommitBody(commit.hash, commit.message)
						},
						{
							key: "div1",
							divider: true
						},
						{
							key: "create-branch",
							label: t("createBranch"),
							onClick: () => setDialog({
								kind: "create-branch",
								hash: commit.hash
							})
						},
						{
							key: "add-tag",
							label: t("addTag"),
							onClick: () => setDialog({
								kind: "add-tag",
								hash: commit.hash
							})
						},
						{
							key: "checkout",
							label: t("checkoutCommit"),
							onClick: () => setDialog({
								kind: "checkout",
								hash: commit.hash
							})
						}
					] : []
				];
				if (commit.heads.length > 0) {
					const branchName = commit.heads[0];
					items.push({
						key: "div2",
						divider: true
					});
					items.push({
						key: "co-branch",
						label: t("checkoutBranch"),
						onClick: () => setDialog({
							kind: "checkout",
							name: branchName
						})
					}, {
						key: "push-branch",
						label: t("pushBranch"),
						onClick: () => setDialog({
							kind: "push",
							target: "branch",
							name: branchName
						})
					}, {
						key: "rename-branch",
						label: t("renameBranch"),
						onClick: () => setDialog({
							kind: "rename-branch",
							name: branchName
						})
					}, {
						key: "delete-branch",
						label: t("deleteBranch"),
						onClick: () => setDialog({
							kind: "delete-branch",
							name: branchName
						})
					}, {
						key: "copy-branch",
						label: t("copyBranchName"),
						onClick: () => copyText(branchName)
					});
				}
				openMenu(event, items);
			}, [
				commits,
				t,
				copyText,
				copyCommitBody,
				openMenu
			]);
			/** Local-branch chip context menu. */
			const openBranchMenu = (0, react.useCallback)((event, name) => {
				openMenu(event, [
					{
						key: "co",
						label: t("checkoutBranch"),
						onClick: () => setDialog({
							kind: "checkout",
							name
						})
					},
					{
						key: "push",
						label: t("pushBranch"),
						onClick: () => setDialog({
							kind: "push",
							target: "branch",
							name
						})
					},
					{
						key: "rename",
						label: t("renameBranch"),
						onClick: () => setDialog({
							kind: "rename-branch",
							name
						})
					},
					{
						key: "delete",
						label: t("deleteBranch"),
						danger: true,
						onClick: () => setDialog({
							kind: "delete-branch",
							name
						})
					},
					{
						key: "copy",
						label: t("copyBranchName"),
						onClick: () => copyText(name)
					}
				]);
			}, [
				t,
				copyText,
				openMenu
			]);
			/** Remote-tracking chip context menu. */
			const openRemoteMenu = (0, react.useCallback)((event, name, remote) => {
				const remoteBranch = remote !== null && name.startsWith(`${remote}/`) ? name.slice(remote.length + 1) : name;
				openMenu(event, [
					{
						key: "copy",
						label: t("copyRemoteName"),
						onClick: () => copyText(name)
					},
					{
						key: "div",
						divider: true
					},
					{
						key: "pull",
						label: t("pullIntoCurrent"),
						onClick: () => setDialog({
							kind: "pull",
							remote: remote ?? "origin",
							branch: remoteBranch
						})
					},
					{
						key: "fetch-into",
						label: t("fetchIntoLocal"),
						onClick: () => setDialog({
							kind: "fetch-into",
							remote: remote ?? "origin",
							branch: remoteBranch
						})
					}
				]);
			}, [
				t,
				copyText,
				openMenu
			]);
			/** Tag chip context menu. */
			const openTagMenu = (0, react.useCallback)((event, name) => {
				openMenu(event, [
					{
						key: "push",
						label: t("pushTag"),
						onClick: () => setDialog({
							kind: "push",
							target: "tag",
							name
						})
					},
					{
						key: "delete",
						label: t("deleteTag"),
						danger: true,
						onClick: () => setDialog({
							kind: "delete-tag",
							name
						})
					},
					{
						key: "copy",
						label: t("copyTagName"),
						onClick: () => copyText(name)
					}
				]);
			}, [
				t,
				copyText,
				openMenu
			]);
			/** Load the remote list when the push dialog opens. */
			(0, react.useEffect)(() => {
				if (dialog === null || dialog.kind !== "push" || sessionId === void 0) return;
				let cancelled = false;
				postWb("/wb-git/remote", body({ action: "list" })).then((value) => {
					if (cancelled) return;
					setRemotes(value.remotes);
					setPushForm((form) => ({
						...form,
						remote: value.remotes.some((r) => r.name === form.remote) ? form.remote : value.remotes[0]?.name ?? "origin"
					}));
				}).catch(() => {
					setRemotes([]);
				});
				return () => {
					cancelled = true;
				};
			}, [
				dialog,
				sessionId,
				body
			]);
			const closeDialog = (0, react.useCallback)(() => setDialog(null), []);
			const handleRefWrite = (0, react.useCallback)(async (payload, summary) => {
				await runWrite(summary, async () => {
					await postWb("/wb-git/ref", body(payload));
				});
				refresh();
			}, [
				runWrite,
				body,
				refresh
			]);
			if (mode === "settings") return (0, react.createElement)(SettingsView, {
				sessionId,
				repoRoot,
				locale,
				t,
				onBack: () => setMode("graph"),
				dateFormat,
				onDateFormatChange: handleDateFormatChange
			});
			if (sessionId === void 0) return (0, react.createElement)("div", { className: "dsh-wb-view dg-view" }, (0, react.createElement)("div", { className: "dg-err" }, t("noSession")));
			if (loadError !== null && commits.length === 0 && isRepo === null) return (0, react.createElement)("div", { className: "dsh-wb-view dg-view" }, (0, react.createElement)("div", { className: "dg-err" }, (0, react.createElement)("div", null, `${t("error")}: ${loadError}`), (0, react.createElement)("button", {
				className: "dg-btn",
				onClick: onRefresh
			}, t("retry"))));
			if (isRepo === false) return (0, react.createElement)("div", { className: "dsh-wb-view dg-view" }, (0, react.createElement)("div", { className: "dg-not-repo" }, (0, react.createElement)("div", null, t("notRepo")), (0, react.createElement)("div", {
				className: "dg-muted",
				style: { marginTop: 4 }
			}, t("notRepoHint")), (0, react.createElement)("button", {
				className: "dg-btn",
				style: { marginTop: 8 },
				onClick: onRefresh
			}, t("retry"))));
			if (isRepo === true && commits.length === 0 && !loading && head === null) return (0, react.createElement)("div", { className: "dsh-wb-view dg-view" }, (0, react.createElement)("div", { className: "dg-empty" }, (0, react.createElement)("div", null, t("emptyRepo")), (0, react.createElement)("button", {
				className: "dg-btn",
				style: { marginTop: 8 },
				onClick: onRefresh
			}, t("refresh"))));
			if (isRepo === true && commits.length === 0 && !loading) return (0, react.createElement)("div", { className: "dsh-wb-view dg-view" }, (0, react.createElement)("div", { className: "dg-empty" }, t("noCommits")));
			if (isRepo === null && loading) return (0, react.createElement)("div", { className: "dsh-wb-view dg-view" }, (0, react.createElement)("div", { className: "dg-loading" }, t("loading")));
			if (isRepo === null && commits.length === 0) return (0, react.createElement)("div", { className: "dsh-wb-view dg-view" }, (0, react.createElement)("div", { className: "dg-loading" }, t("loading")));
			const headerNodes = [
				(0, react.createElement)("span", {
					key: "repo",
					className: "dg-repo",
					title: root ?? repoRoot
				}, repoName),
				(0, react.createElement)("span", {
					key: "branch",
					className: "dg-muted",
					title: branch ?? ""
				}, branch ?? ""),
				(0, react.createElement)("span", {
					key: "count",
					className: "dg-muted"
				}, t("commitsCount", { n: commits.length })),
				(0, react.createElement)("span", {
					key: "spacer",
					className: "dg-header-spacer"
				})
			];
			const branchOptions = [{
				value: "",
				label: t("allBranches")
			}, ...branches.filter((b) => showRemote || b.remote === null).map((b) => ({
				value: b.name,
				label: b.current ? `${b.name} *` : b.name
			}))];
			headerNodes.push((0, react.createElement)("select", {
				key: "filter",
				className: "dg-header-select",
				value: branchFilter ?? "",
				title: t("allBranches"),
				onChange: (event) => setBranchFilter(event.target.value === "" ? null : event.target.value)
			}, branchOptions.map((option) => {
				const value = typeof option === "string" ? option : option.value;
				const label = typeof option === "string" ? option : option.label;
				return (0, react.createElement)("option", {
					key: value,
					value
				}, label);
			})), (0, react.createElement)("label", {
				key: "remote-toggle",
				className: "dg-toggle"
			}, (0, react.createElement)("input", {
				type: "checkbox",
				checked: showRemote,
				onChange: (event) => setShowRemote(event.target.checked)
			}), t("showRemoteBranches")), (0, react.createElement)("button", {
				key: "changes",
				className: "dg-btn",
				disabled: busy,
				onClick: () => setCommitPanelOpen((open) => !open)
			}, t("commitPanelTitle")), (0, react.createElement)("button", {
				key: "settings",
				className: "dg-btn",
				onClick: () => setMode("settings")
			}, t("settings")), (0, react.createElement)("button", {
				key: "refresh",
				className: "dg-btn",
				disabled: busy,
				onClick: onRefresh
			}, t("refresh")), more ? (0, react.createElement)("button", {
				key: "more",
				className: "dg-btn",
				disabled: busy || loading,
				onClick: onLoadMore
			}, t("loadMore")) : null, (0, react.createElement)("button", {
				key: "fetch",
				className: "dg-btn",
				disabled: busy,
				onClick: onFetch
			}, t("fetchButton")));
			const rowNodes = [];
			for (const row of layout.rows) {
				const commit = commits[row.id];
				if (commit === void 0) continue;
				dotPosition(row);
				const isPseudo = commit.hash === "*";
				const refNodes = [];
				const refStyle = (name) => {
					const c = refColour(name);
					return {
						color: c,
						borderColor: c,
						background: `${c}1f`
					};
				};
				for (const headName of commit.heads) {
					const active = headName === branch;
					refNodes.push((0, react.createElement)("span", {
						key: `h-${headName}`,
						className: active ? "dg-ref dg-ref-head dg-ref-active" : "dg-ref dg-ref-head",
						style: refStyle(headName),
						title: headName,
						onContextMenu: (event) => openBranchMenu(event, headName)
					}, refIcon("head"), headName));
				}
				for (const remote of commit.remotes) refNodes.push((0, react.createElement)("span", {
					key: `r-${remote.name}`,
					className: "dg-ref dg-ref-remote",
					style: refStyle(remote.name),
					title: remote.name,
					onContextMenu: (event) => openRemoteMenu(event, remote.name, remote.remote)
				}, refIcon("remote"), remote.name));
				for (const tag of commit.tags) refNodes.push((0, react.createElement)("span", {
					key: `t-${tag.name}`,
					className: "dg-ref dg-ref-tag",
					style: refStyle(tag.name),
					title: tag.annotated ? `${tag.name} (annotated)` : tag.name,
					onContextMenu: (event) => openTagMenu(event, tag.name)
				}, refIcon("tag"), tag.name));
				const rowClass = `dg-row${row.id === selectedId ? " dg-row-selected" : ""}${isPseudo ? " dg-uncommitted" : ""}`;
				rowNodes.push((0, react.createElement)("div", {
					key: `row-${row.id}`,
					className: rowClass,
					style: { paddingLeft: layout.width + 10 },
					onClick: () => toggleRow(row.id),
					onContextMenu: (event) => openCommitMenu(event, row.id),
					title: isPseudo ? t("uncommittedChanges") : commit.message
				}, ...refNodes, (0, react.createElement)("span", {
					key: "msg",
					className: "dg-msg"
				}, commit.message), (0, react.createElement)("span", {
					key: "date",
					className: "dg-date dg-muted"
				}, formatDate(commit.date, Math.round(Date.now() / 1e3), dateFormat, t)), (0, react.createElement)("span", {
					key: "author",
					className: "dg-author dg-muted"
				}, commit.author), (0, react.createElement)("span", {
					key: "hash",
					className: "dg-hash dg-muted"
				}, shortHash(commit.hash))));
				if (row.id === expandedId && !isPseudo) {
					const inlineBody = [];
					if (detailLoading) inlineBody.push((0, react.createElement)("div", {
						key: "loading",
						className: "dg-inline-meta-loading"
					}, t("loading")));
					else if (detailError !== null) inlineBody.push((0, react.createElement)("div", {
						key: "error",
						className: "dg-inline-meta-loading"
					}, t("operationFailed", { msg: detailError }), (0, react.createElement)("button", {
						className: "dg-btn",
						style: { marginLeft: 8 },
						onClick: () => setDetailRetryTick((n) => n + 1)
					}, t("retry"))));
					else if (detail !== null) {
						const meta = detail.meta;
						inlineBody.push((0, react.createElement)("div", {
							key: "hash",
							className: "dg-meta-row"
						}, (0, react.createElement)("span", { className: "dg-meta-label" }, t("commitLabel")), meta.hash), (0, react.createElement)("div", {
							key: "parents",
							className: "dg-meta-row"
						}, (0, react.createElement)("span", { className: "dg-meta-label" }, t("parentsLabel")), meta.parents.length === 0 ? (0, react.createElement)("span", { className: "dg-muted" }, t("root")) : meta.parents.map((parent, i) => (0, react.createElement)("span", {
							key: parent,
							className: "dg-parent-link",
							style: { marginLeft: i > 0 ? 8 : 0 },
							onClick: (event) => {
								event.stopPropagation();
								selectByHash(parent);
							}
						}, shortHash(parent)))), (0, react.createElement)("div", {
							key: "author",
							className: "dg-meta-row"
						}, (0, react.createElement)("span", { className: "dg-meta-label" }, t("authorLabel")), `${meta.author} <${meta.authorEmail}> ${formatDate(meta.authorDate, Math.round(Date.now() / 1e3), dateFormat, t)}`), (0, react.createElement)("div", {
							key: "committer",
							className: "dg-meta-row"
						}, (0, react.createElement)("span", { className: "dg-meta-label" }, t("committerLabel")), `${meta.committer} <${meta.committerEmail}> ${formatDate(meta.committerDate, Math.round(Date.now() / 1e3), dateFormat, t)}`), (0, react.createElement)("div", {
							key: "body",
							className: "dg-inline-body"
						}, meta.body));
					}
					rowNodes.push((0, react.createElement)("div", {
						key: `meta-${row.id}`,
						className: "dg-inline-meta",
						style: { height: INLINE_META_HEIGHT }
					}, (0, react.createElement)("div", {
						key: "gutter",
						className: "dg-inline-meta-gutter",
						style: { width: layout.width + 10 }
					}), (0, react.createElement)("div", {
						key: "body",
						className: "dg-inline-meta-body"
					}, ...inlineBody)));
				}
			}
			const svgNodes = [];
			for (const path of svgPaths) {
				const stroke = path.isCommitted ? COLOURS[path.colourIndex] : "#808080";
				svgNodes.push((0, react.createElement)("path", {
					key: `s-${svgNodes.length}`,
					className: "shadow",
					d: path.d
				}), (0, react.createElement)("path", {
					key: `l-${svgNodes.length}`,
					className: "line",
					d: path.d,
					stroke
				}));
			}
			for (const row of layout.rows) {
				const dot = dotPosition(row);
				const colour = row.isCommitted ? COLOURS[row.colourIndex] : "#808080";
				if (row.isCurrent) svgNodes.push((0, react.createElement)("circle", {
					key: `dot-${row.id}`,
					className: "current",
					cx: dot.x,
					cy: dot.y,
					r: 4,
					stroke: colour,
					onClick: () => toggleRow(row.id)
				}));
				else svgNodes.push((0, react.createElement)("circle", {
					key: `dot-${row.id}`,
					cx: dot.x,
					cy: dot.y,
					r: 4,
					fill: colour,
					onClick: () => toggleRow(row.id)
				}));
			}
			let panelNode = null;
			if (panelOpen && panelHash !== null) {
				const commit = commits.find((c) => c.hash === panelHash);
				const panelTitle = commit !== void 0 ? commit.message : shortHash(panelHash);
				const handleResizeStart = (event) => {
					event.preventDefault();
					const startY = event.clientY;
					const startHeight = panelHeight;
					const onMove = (moveEvent) => {
						const next = Math.min(520, Math.max(80, startHeight + (startY - moveEvent.clientY)));
						setPanelHeight(next);
					};
					const onUp = () => {
						window.removeEventListener("mousemove", onMove);
						window.removeEventListener("mouseup", onUp);
					};
					window.addEventListener("mousemove", onMove);
					window.addEventListener("mouseup", onUp);
				};
				let bodyNode;
				if (panelMode === "diff") {
					const diffLines = panelDetail !== null ? panelDetail.diff.split("\n") : [];
					bodyNode = (0, react.createElement)("div", { className: "dg-detail-body" }, panelDetail !== null ? (0, react.createElement)("div", { className: "dg-raw-diff" }, diffLines.map((line, i) => (0, react.createElement)("div", {
						key: `d-${i}`,
						className: rawDiffLineClass(line)
					}, line === "" ? "\xA0" : line))) : (0, react.createElement)("div", { className: "dg-loading" }, t("loading")));
				} else {
					const groups = groupFiles(panelDetail?.files ?? []);
					const treeNodes = [];
					if (panelDetail === null) treeNodes.push((0, react.createElement)("div", {
						key: "loading",
						className: "dg-loading"
					}, t("loading")));
					else {
						for (const group of groups) {
							const collapsed = collapsedDirs.has(group.dir);
							if (group.dir !== "") treeNodes.push((0, react.createElement)("div", {
								key: `dir-${group.dir}`,
								className: "dg-tree-dir dg-tree-item",
								onClick: () => {
									setCollapsedDirs((prev) => {
										const next = new Set(prev);
										if (next.has(group.dir)) next.delete(group.dir);
										else next.add(group.dir);
										return next;
									});
								}
							}, (0, react.createElement)("span", { className: "dg-tree-arrow" }, collapsed ? "▸" : "▾"), (0, react.createElement)("span", { className: "dg-tree-name" }, group.dir)));
							if (!collapsed) for (const file of group.files) {
								const name = group.dir === "" ? file.path : file.path.slice(group.dir.length + 1);
								treeNodes.push((0, react.createElement)("div", {
									key: file.path,
									className: `dg-tree-item${selectedFile === file.path ? " dg-tree-active" : ""}`,
									onClick: () => setSelectedFile(file.path),
									title: file.path
								}, (0, react.createElement)("span", { className: `dg-file-status dg-file-${file.status}` }, file.status), (0, react.createElement)("span", { className: "dg-tree-name" }, name), (0, react.createElement)("span", { className: "dg-file-stats" }, file.additions !== null && file.additions > 0 ? (0, react.createElement)("span", { className: "dg-file-add" }, `+${file.additions}`) : null, file.deletions !== null && file.deletions > 0 ? (0, react.createElement)("span", { className: "dg-file-del" }, `-${file.deletions}`) : null)));
							}
						}
						if (groups.length === 0) treeNodes.push((0, react.createElement)("div", {
							key: "empty",
							className: "dg-content-empty"
						}, t("noFileSelected")));
					}
					let diffNode;
					if (selectedFile === null) diffNode = (0, react.createElement)("div", { className: "dg-content-empty" }, t("noFileSelected"));
					else if (contentLoading) diffNode = (0, react.createElement)("div", { className: "dg-content-empty" }, t("loading"));
					else if (oldContent === null || newContent === null) diffNode = (0, react.createElement)("div", { className: "dg-content-empty" }, t("noFileSelected"));
					else if (oldContent.binary || newContent.binary) diffNode = (0, react.createElement)("div", { className: "dg-content-empty" }, t("binaryFile"));
					else {
						const rows = diffText(oldContent.content ?? "", newContent.content ?? "");
						const lineClass = (cell) => {
							if (cell === void 0) return "dg-diff-line dg-diff-empty";
							if (cell.type === "add") return "dg-diff-line dg-diff-add";
							if (cell.type === "del") return "dg-diff-line dg-diff-del";
							return "dg-diff-line dg-diff-same";
						};
						const oldPane = rows.map((row, i) => (0, react.createElement)("div", {
							key: `o-${i}`,
							className: lineClass(row.old)
						}, row.old?.text ?? "\xA0"));
						const newPane = rows.map((row, i) => (0, react.createElement)("div", {
							key: `n-${i}`,
							className: lineClass(row.new)
						}, row.new?.text ?? "\xA0"));
						const oldLines = oldContent.content.split("\n").length;
						const newLines = newContent.content.split("\n").length;
						const tooLong = oldContent.truncated || newContent.truncated;
						const capped = oldLines > MAX_DIFF_LINES || newLines > MAX_DIFF_LINES;
						diffNode = (0, react.createElement)("div", { className: "dg-diff-container" }, tooLong ? (0, react.createElement)("div", { className: "dg-content-title" }, t("contentTooLong", { n: rows.length })) : null, (0, react.createElement)("div", { className: "dg-diff" }, (0, react.createElement)("div", { className: "dg-diff-header" }, (0, react.createElement)("div", { className: "dg-content-title" }, t("beforeLabel")), (0, react.createElement)("div", { className: "dg-content-title" }, t("afterLabel"))), capped ? (0, react.createElement)("div", { className: "dg-content-title" }, t("diffRowsTooLong", { n: rows.length })) : null, (0, react.createElement)("div", { className: "dg-diff-body" }, (0, react.createElement)("div", {
							className: "dg-diff-pane",
							ref: oldPaneRef,
							onScroll: () => {
								if (oldPaneRef.current !== null && newPaneRef.current !== null) {
									newPaneRef.current.scrollLeft = oldPaneRef.current.scrollLeft;
									newPaneRef.current.scrollTop = oldPaneRef.current.scrollTop;
								}
							}
						}, (0, react.createElement)("div", { className: "dg-diff-lines" }, ...oldPane)), (0, react.createElement)("div", {
							className: "dg-diff-pane",
							ref: newPaneRef,
							onScroll: () => {
								if (oldPaneRef.current !== null && newPaneRef.current !== null) {
									oldPaneRef.current.scrollLeft = newPaneRef.current.scrollLeft;
									oldPaneRef.current.scrollTop = newPaneRef.current.scrollTop;
								}
							}
						}, (0, react.createElement)("div", { className: "dg-diff-lines" }, ...newPane)))));
					}
					bodyNode = (0, react.createElement)("div", { className: "dg-detail-panel-body" }, (0, react.createElement)("div", { className: "dg-detail-cols" }, (0, react.createElement)("div", { className: "dg-file-tree" }, (0, react.createElement)("div", { className: "dg-file-tree-title" }, t("filesLabel")), ...treeNodes), diffNode));
				}
				panelNode = (0, react.createElement)("div", {
					className: "dg-detail-panel-bottom",
					style: { height: panelHeight }
				}, (0, react.createElement)("div", {
					className: "dg-detail-resize",
					title: t("dragHint"),
					onMouseDown: handleResizeStart
				}), (0, react.createElement)("div", { className: "dg-detail-panel-head" }, (0, react.createElement)("span", {
					className: "dg-detail-panel-title",
					title: panelTitle
				}, panelTitle), (0, react.createElement)("button", {
					className: "dg-btn",
					title: panelMode === "files" ? t("viewDetails") : t("filesLabel"),
					onClick: () => setPanelMode((m) => m === "files" ? "diff" : "files")
				}, panelMode === "files" ? "⧉" : "≡"), (0, react.createElement)("button", {
					className: "dg-btn",
					onClick: () => {
						setPanelOpen(false);
						setPanelHash(null);
					}
				}, t("close"))), bodyNode);
			}
			let commitPanelNode = null;
			if (commitPanelOpen) {
				const fileRows = statusFiles.map((file) => {
					const staged = file.staged;
					return (0, react.createElement)("div", {
						key: file.path,
						className: "dg-commit-row",
						title: file.oldPath !== void 0 ? `${file.oldPath} → ${file.path}` : file.path
					}, (0, react.createElement)("span", { className: `dg-file-status dg-file-${file.status}` }, file.status), (0, react.createElement)("span", { className: "dg-tree-name" }, file.path), (0, react.createElement)("button", {
						className: "dg-btn dg-commit-row-btn",
						disabled: busy,
						onClick: () => {
							runWrite(null, async () => {
								await postWb("/wb-git/stage", body({
									action: staged ? "unstage" : "add",
									path: file.path
								}));
							}).then((ok) => {
								if (ok) reloadStatus();
							});
						}
					}, staged ? t("unstage") : t("stage")));
				});
				const stageAllDisabled = statusFiles.length === 0 || statusFiles.every((f) => f.staged);
				commitPanelNode = (0, react.createElement)("div", { className: "dg-commit-panel" }, (0, react.createElement)("div", { className: "dg-commit-body" }, statusFiles.length === 0 ? (0, react.createElement)("div", { className: "dg-commit-empty" }, t("noChanges")) : (0, react.createElement)("div", null, ...fileRows), (0, react.createElement)("div", { className: "dg-commit-actions" }, (0, react.createElement)("button", {
					className: "dg-btn",
					disabled: busy || stageAllDisabled,
					onClick: () => {
						runWrite(null, async () => {
							await postWb("/wb-git/stage", body({
								action: "add",
								all: true
							}));
						}).then((ok) => {
							if (ok) reloadStatus();
						});
					}
				}, t("stageAll")), (0, react.createElement)("span", { className: "dg-commit-hint dg-muted" }, commitMsg.trim() === "" ? t("emptyMessage") : "")), (0, react.createElement)("textarea", {
					className: "dg-commit-msg",
					value: commitMsg,
					placeholder: t("commitMessagePlaceholder"),
					onChange: (event) => setCommitMsg(event.target.value)
				}), (0, react.createElement)("button", {
					className: "dg-btn dg-commit-btn",
					disabled: busy || commitMsg.trim() === "",
					onClick: () => {
						const message = commitMsg.trim();
						runWrite(null, async () => {
							const value = await postWb("/wb-git/commit", body({ message }));
							setOpMsg(t("commitDone", { hash: value.hash !== null ? shortHash(value.hash) : "" }));
						}, (msg) => setCommitError(msg)).then((ok) => {
							if (ok) {
								setCommitMsg("");
								refresh();
								reloadStatus();
							}
						});
					}
				}, t("commitButton")), commitError !== null ? (0, react.createElement)("div", { className: "dg-commit-error" }, commitError) : null));
			}
			let dialogNode = null;
			if (dialog !== null) switch (dialog.kind) {
				case "create-branch":
					dialogNode = (0, react.createElement)(PromptDialog, {
						key: "create-branch",
						title: t("createBranchTitle"),
						label: t("promptBranchName"),
						okLabel: t("dialogOk"),
						cancelLabel: t("dialogCancel"),
						onOk: (name) => {
							setDialog(null);
							handleRefWrite({
								action: "create-branch",
								name,
								hash: dialog.hash
							}, t("branchCreated", { name }));
						},
						onCancel: closeDialog
					});
					break;
				case "add-tag":
					dialogNode = (0, react.createElement)(PromptDialog, {
						key: "add-tag",
						title: t("addTagTitle"),
						label: t("promptTagName"),
						okLabel: t("dialogOk"),
						cancelLabel: t("dialogCancel"),
						onOk: (name) => {
							setDialog(null);
							handleRefWrite({
								action: "create-tag",
								name,
								hash: dialog.hash
							}, t("tagCreated", { name }));
						},
						onCancel: closeDialog
					});
					break;
				case "checkout": {
					const refLabel = dialog.hash !== void 0 ? shortHash(dialog.hash) : dialog.name ?? "";
					dialogNode = (0, react.createElement)(Dialog, {
						key: "checkout",
						open: true,
						title: t("checkoutTitle"),
						okLabel: t("dialogOk"),
						cancelLabel: t("dialogCancel"),
						onOk: () => {
							const payload = dialog.hash !== void 0 ? {
								action: "checkout",
								hash: dialog.hash
							} : {
								action: "checkout",
								name: dialog.name
							};
							setDialog(null);
							handleRefWrite(payload, t("checkedOut", { ref: refLabel }));
						},
						onCancel: closeDialog
					}, (0, react.createElement)("div", null, t("confirmCheckout", { ref: refLabel })));
					break;
				}
				case "rename-branch":
					dialogNode = (0, react.createElement)(PromptDialog, {
						key: "rename-branch",
						title: t("renameBranchTitle"),
						label: t("promptNewBranchName"),
						initialValue: dialog.name,
						okLabel: t("dialogOk"),
						cancelLabel: t("dialogCancel"),
						onOk: (newName) => {
							setDialog(null);
							handleRefWrite({
								action: "rename-branch",
								name: dialog.name,
								newName
							}, t("branchRenamed", { name: newName }));
						},
						onCancel: closeDialog
					});
					break;
				case "delete-branch":
					dialogNode = (0, react.createElement)(Dialog, {
						key: "delete-branch",
						open: true,
						title: t("deleteBranchTitle"),
						okLabel: t("dialogOk"),
						cancelLabel: t("dialogCancel"),
						onOk: () => {
							setDialog(null);
							handleRefWrite({
								action: "delete-branch",
								name: dialog.name
							}, t("branchDeleted", { name: dialog.name }));
						},
						onCancel: closeDialog
					}, (0, react.createElement)("div", null, t("confirmDeleteBranch", { name: dialog.name })));
					break;
				case "delete-tag":
					dialogNode = (0, react.createElement)(Dialog, {
						key: "delete-tag",
						open: true,
						title: t("deleteTagTitle"),
						okLabel: t("dialogOk"),
						cancelLabel: t("dialogCancel"),
						onOk: () => {
							setDialog(null);
							handleRefWrite({
								action: "delete-tag",
								name: dialog.name
							}, t("tagDeleted", { name: dialog.name }));
						},
						onCancel: closeDialog
					}, (0, react.createElement)("div", null, t("confirmDeleteTag", { name: dialog.name })));
					break;
				case "push": {
					const isBranch = dialog.target === "branch";
					const okDisabled = remotes.length === 0 || pushForm.remote === "";
					dialogNode = (0, react.createElement)(Dialog, {
						key: "push",
						open: true,
						title: isBranch ? t("pushDialogTitleBranch") : t("pushDialogTitleTag"),
						okLabel: t("dialogOk"),
						cancelLabel: t("dialogCancel"),
						okDisabled,
						onOk: () => {
							const { remote, setUpstream, mode } = pushForm;
							setDialog(null);
							if (isBranch) handleRefWrite({
								action: "push-branch",
								name: dialog.name,
								remote,
								setUpstream,
								mode
							}, t("pushBranchDone"));
							else handleRefWrite({
								action: "push-tag",
								name: dialog.name,
								remote
							}, t("pushTagDone"));
						},
						onCancel: closeDialog
					}, (0, react.createElement)(DialogInput, {
						label: isBranch ? t("pushBranchLabel") : t("promptTagName"),
						value: dialog.name,
						onChange: () => {}
					}), (0, react.createElement)(DialogSelect, {
						label: t("pushRemoteLabel"),
						value: pushForm.remote,
						options: remotes.length > 0 ? remotes.map((r) => r.name) : [t("emptyRemotes")],
						onChange: (remote) => setPushForm((f) => ({
							...f,
							remote
						}))
					}), isBranch ? (0, react.createElement)(DialogCheck, {
						label: t("pushSetUpstream"),
						checked: pushForm.setUpstream,
						onChange: (checked) => setPushForm((f) => ({
							...f,
							setUpstream: checked
						}))
					}) : null, (0, react.createElement)(DialogSelect, {
						label: t("pushModeLabel"),
						value: pushForm.mode,
						options: [{
							value: "normal",
							label: t("pushModeNormal")
						}, {
							value: "force-with-lease",
							label: t("pushModeForce")
						}],
						onChange: (mode) => setPushForm((f) => ({
							...f,
							mode: mode === "force-with-lease" ? "force-with-lease" : "normal"
						}))
					}));
					break;
				}
				case "pull":
					dialogNode = (0, react.createElement)(Dialog, {
						key: "pull",
						open: true,
						title: t("pullIntoCurrent"),
						okLabel: t("dialogOk"),
						cancelLabel: t("dialogCancel"),
						onOk: () => {
							const { remote, branch: branchName } = dialog;
							setDialog(null);
							runWrite(t("pullDone", {
								remote,
								branch: branchName
							}), async () => {
								await postWb("/wb-git/pull", body({
									remote,
									branch: branchName
								}));
							}).then((ok) => {
								if (ok) refresh();
							});
						},
						onCancel: closeDialog
					}, (0, react.createElement)("div", null, t("confirmPull", {
						remote: dialog.remote,
						branch: dialog.branch
					})));
					break;
				case "fetch-into": dialogNode = (0, react.createElement)(PromptDialog, {
					key: "fetch-into",
					title: t("fetchIntoLocal"),
					label: t("promptLocalBranch"),
					okLabel: t("dialogOk"),
					cancelLabel: t("dialogCancel"),
					onOk: (localBranch) => {
						const { remote, branch: remoteBranch } = dialog;
						setDialog(null);
						runWrite(t("fetchIntoDone", {
							remote,
							remoteBranch,
							localBranch
						}), async () => {
							await postWb("/wb-git/fetch-into", body({
								remote,
								remoteBranch,
								localBranch
							}));
						}).then((ok) => {
							if (ok) refresh();
						});
					},
					onCancel: closeDialog
				});
			}
			return (0, react.createElement)("div", { className: "dsh-wb-view dg-view" }, (0, react.createElement)("div", { className: "dg-header" }, ...headerNodes), (0, react.createElement)("div", {
				className: "dg-rows",
				ref: rowsRef
			}, (0, react.createElement)("svg", {
				className: "dg-graph",
				width: layout.width,
				height: layout.height
			}, ...svgNodes), ...rowNodes), panelNode, commitPanelNode, opError !== null ? (0, react.createElement)("div", {
				className: "dg-op-error",
				key: "op-error"
			}, opError) : null, opMsg !== null ? (0, react.createElement)("div", {
				className: "dg-op-msg",
				key: "op-msg"
			}, opMsg) : null, menu !== null ? (0, react.createElement)(ContextMenu, {
				x: menu.x,
				y: menu.y,
				items: menu.items,
				onClose: () => setMenu(null)
			}) : null, dialogNode);
		}
		//#endregion
		//#region src/client/GitLauncher.tsx
		/**
		* Git launcher (dock side-bar pane 'git'): clicking the dock 'git'
		* activity item scans the workspace for git repositories (host
		* /wb-git/repos, cwd + two levels) and either
		*   - opens the full history graph in an independent floating window and
		*     collapses the dock when the workspace itself is the only repository
		*     (repos.length === 1 && depth === 0 — the original single-repo flow,
		*     request carries no repoRoot), or
		*   - shows a repository picker in the side bar (like the dock-files tree
		*     panel) for multi-repo workspaces: repo name + path + depth badge;
		*     clicking one opens the graph window seeded with that repo's root
		*     (meta.repoRoot) and collapses the dock.
		* Empty scans ("no git repositories") and failed scans keep the pane visible
		* with a hint / error + retry.
		*/
		/** Depth badge label: 工作区 / 子目录 / 孙目录 (unknown depths fall back to d<N>). */
		function depthLabel(depth, t) {
			if (depth === 0) return t("depthWorkspace");
			if (depth === 1) return t("depthSub");
			if (depth === 2) return t("depthNested");
			return `d${depth}`;
		}
		function GitLauncher(props) {
			const { ctx, sessionId, active } = props;
			const workbench = ctx.get("workbench");
			const locale = useLocale(ctx);
			const t = (0, react.useCallback)((key, params) => translate(locale, key, params), [locale]);
			const [repos, setRepos] = (0, react.useState)(null);
			const [cwd, setCwd] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [reloadTick, setReloadTick] = (0, react.useState)(0);
			/** Monotonic scan sequence: a rapid re-activation/retry cannot let a stale
			*  /wb-git/repos response overwrite a newer one. */
			const scanSeq = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				setRepos(null);
				setCwd(null);
			}, [sessionId]);
			(0, react.useEffect)(() => {
				if (!active || sessionId === void 0 || workbench === void 0) return;
				const seq = ++scanSeq.current;
				let cancelled = false;
				setLoading(true);
				setError(null);
				postWb("/wb-git/repos", { sessionId }).then((value) => {
					if (cancelled || seq !== scanSeq.current) return;
					setCwd(value.cwd);
					setRepos(value.repos);
					setLoading(false);
					if (value.repos.length === 1 && value.repos[0].depth === 0) {
						workbench.openView(GRAPH_VIEW_ID, { title: t("graphTitle") }, { floating: true });
						workbench.updateLayout({
							activity: null,
							sideBarOpen: false
						});
					}
				}).catch((cause) => {
					if (cancelled || seq !== scanSeq.current) return;
					setError(messageOf(cause));
					setLoading(false);
				});
				return () => {
					cancelled = true;
				};
			}, [
				active,
				sessionId,
				workbench,
				t,
				reloadTick
			]);
			/** Pick one repository → open its history in the floating window, collapse. */
			const openRepo = (repo) => {
				if (workbench === void 0) return;
				workbench.openView(GRAPH_VIEW_ID, {
					title: repo.name,
					meta: { repoRoot: repo.root }
				}, { floating: true });
				workbench.updateLayout({
					activity: null,
					sideBarOpen: false
				});
			};
			if (sessionId === void 0) return (0, react.createElement)("div", { className: "dsh-wb-view dg-repo-list" }, (0, react.createElement)("div", { className: "dg-repo-empty" }, t("noSession")));
			if (error !== null) return (0, react.createElement)("div", { className: "dsh-wb-view dg-repo-list" }, (0, react.createElement)("div", { className: "dg-err" }, `${t("error")}: ${error}`), (0, react.createElement)("button", {
				className: "dg-btn",
				style: { margin: "4px 2px" },
				onClick: () => setReloadTick((n) => n + 1)
			}, t("retry")));
			if (repos === null) return (0, react.createElement)("div", { className: "dsh-wb-view dg-repo-list" }, (0, react.createElement)("div", { className: "dg-loading" }, loading ? t("loading") : "…"));
			const rows = repos.map((repo) => (0, react.createElement)("div", {
				key: repo.root,
				className: "dg-repo-item",
				title: repo.root,
				onClick: () => openRepo(repo)
			}, (0, react.createElement)("div", { className: "dg-repo-item-top" }, (0, react.createElement)("span", { className: "dg-repo-name" }, repo.name), (0, react.createElement)("span", {
				className: `dg-repo-depth dg-repo-depth-${Math.min(repo.depth, 2)}`,
				title: t("openRepo")
			}, depthLabel(repo.depth, t))), (0, react.createElement)("div", {
				className: "dg-repo-path",
				title: repo.root
			}, repo.root)));
			return (0, react.createElement)("div", { className: "dsh-wb-view dg-repo-list" }, repos.length > 0 ? (0, react.createElement)("div", { className: "dg-repo-list-hint" }, t("repoListHint")) : null, repos.length === 0 ? (0, react.createElement)("div", { className: "dg-repo-empty" }, (0, react.createElement)("div", null, t("noReposFound")), cwd !== null ? (0, react.createElement)("div", {
				className: "dg-muted",
				style: {
					marginTop: 4,
					fontSize: 12
				}
			}, cwd) : null) : rows);
		}
		//#endregion
		//#region src/client/styles.ts
		/**
		* dock-git shell styles: the git history panel needs hover/selected feedback,
		* ref chips and the SVG line/dot styling, which inline styles cannot fully
		* express — injected once as a <style data-plugin="dock-git"> tag (same
		* pattern as dock-files / the dock base).
		*
		* Colours use DSH theme variables with light-theme fallbacks (the dock-files
		* convention); the swimlane palette and the ref chip accents are fixed values
		* adapted for DSH theming.
		*/
		const CSS = `
.dg-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  /* The workbench's .dsh-wb-view wrapper adds 8px padding; keep the total
     (padding included) at exactly the window body height so the floating
     window never grows a global scrollbar. */
  box-sizing: border-box;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, #1f2328);
  overflow: hidden;
}
.dg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  font-size: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
  row-gap: 4px;
}
.dg-repo {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}
.dg-header-spacer { flex: 1; }
.dg-btn {
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  background: transparent;
  color: var(--dsw-alias-label-primary, #1f2328);
  border-radius: 5px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
}
.dg-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dg-btn:disabled { opacity: 0.55; cursor: default; }
.dg-btn-danger { color: #d1242f; border-color: rgba(209, 36, 47, 0.45); }
.dg-btn-danger:hover { background: rgba(209, 36, 47, 0.10); }

/* Header controls: branch filter dropdown + show-remote toggle. */
.dg-header-select {
  max-width: 150px;
  font-size: 12px;
  padding: 2px 4px;
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  flex-shrink: 0;
}
.dg-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #656d76);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.dg-toggle input { margin: 0; cursor: pointer; }

/* Rows container: SVG overlay is absolutely positioned over the row list. */
.dg-rows {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.dg-graph {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  pointer-events: none;
  overflow: visible;
}
.dg-graph circle { pointer-events: all; cursor: pointer; }
.dg-graph .shadow {
  fill: none;
  stroke: var(--dsw-alias-bg-layer-2, #ffffff);
  stroke-opacity: 0.75;
  stroke-width: 4;
}
.dg-graph .line { fill: none; stroke-width: 2; }
.dg-graph circle.current {
  fill: var(--dsw-alias-bg-layer-2, #ffffff);
  stroke-width: 2;
}

/* One commit row (24px = GRID.y, aligned with the SVG dots). */
.dg-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  line-height: 24px;
  padding-right: 12px;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  box-sizing: border-box;
  border-left: 2px solid transparent;
}
.dg-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.10)); }
.dg-row-selected {
  background: var(--dsw-alias-interactive-bg-hover-accent, rgba(9, 105, 218, 0.12));
  border-left-color: var(--dsw-alias-interactive-bg-hover-accent, rgba(9, 105, 218, 0.6));
}
.dg-uncommitted { color: var(--dsw-alias-label-secondary, #656d76); font-style: italic; }

/* Ref chips (DSH-themed). */
.dg-ref {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 18px;
  line-height: 18px;
  margin: 2px 5px 0 0;
  padding: 0 6px;
  background-color: rgba(128, 128, 128, 0.15);
  border-radius: 5px;
  border: 1px solid rgba(128, 128, 128, 0.75);
  font-size: 12px;
  cursor: default;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  vertical-align: top;
  flex-shrink: 0;
}
.dg-ref-icon {
  flex: none;
  opacity: 0.85;
}
.dg-ref-head { border-color: #1a7f37; color: #1a7f37; background: rgba(26, 127, 55, 0.12); }
.dg-ref-remote { border-color: #8250df; color: #8250df; background: rgba(130, 80, 223, 0.12); }
.dg-ref-tag { border-color: #9a6700; color: #9a6700; background: rgba(154, 103, 0, 0.12); }
/* Current-branch badge: the lane colour arrives inline (border/color/background
   overrides from CommitView); the class adds the emphasis ring + weight,
   derived from currentColor (= the lane colour), so it adapts to light and
   dark themes automatically. */
.dg-ref-active {
  font-weight: 600;
  box-shadow: 0 0 0 1px currentColor;
}

.dg-msg { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dg-muted { color: var(--dsw-alias-label-secondary, #656d76); }
.dg-date, .dg-author, .dg-hash { font-size: 12px; flex-shrink: 0; }

/* Bottom-docked commit detail panel. */
.dg-detail-panel {
  flex-shrink: 0;
  max-height: 45%;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
}

/* Compact inline commit info shown right under its expanded row. The lane
   gutter stays transparent (the swimlane lines bridge through the band), and
   the panel itself — background, borders — starts right of the graph. */
.dg-inline-meta {
  box-sizing: border-box; /* total height matches INLINE_META_HEIGHT/expandY */
  display: flex;
  align-items: stretch;
  overflow: hidden;
  flex-shrink: 0;
  font-size: 12px;
}
.dg-inline-meta-gutter {
  flex: 0 0 auto;
  height: 100%;
}
.dg-inline-meta-loading {
  color: var(--dsw-alias-label-secondary, #656d76);
  padding: 4px 10px;
}
.dg-inline-meta-body {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 10px;
  /* The whole strip scrolls when its content is taller than the strip, so
     nothing becomes unreachable; horizontal stays hidden (rows wrap). */
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-left: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
}
.dg-inline-body {
  white-space: pre-wrap;
  font-size: 12px;
  margin: 2px 0 0;
  max-height: 96px;
  overflow-y: auto;
  /* pre-wrap wraps normal lines; hide the rare unbreakable-token scrollbar. */
  overflow-x: hidden;
  color: var(--dsw-alias-label-primary, #1f2328);
}

/* Bottom-docked three-column detail panel (resizable height). */
.dg-detail-panel-bottom {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  overflow: hidden;
}
.dg-detail-resize {
  height: 6px;
  min-height: 6px;
  cursor: ns-resize;
  background: var(--dsw-alias-border-l2, #d8dbe0);
  flex-shrink: 0;
  transition: background 0.15s ease;
}
.dg-detail-resize:hover {
  background: var(--dsw-alias-link-primary, #0969da);
}
.dg-detail-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  font-size: 12px;
  flex-shrink: 0;
}
.dg-detail-panel-title {
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-detail-panel-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.dg-detail-cols {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.dg-file-tree {
  flex: 0 0 28%;
  min-width: 120px;
  overflow: auto;
  border-right: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  padding: 4px 0;
  font-size: 12px;
}
.dg-file-tree-title {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px 4px;
  color: var(--dsw-alias-label-secondary, #656d76);
}
.dg-tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dg-tree-item:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.10));
}
.dg-tree-active {
  background: var(--dsw-alias-interactive-bg-hover-accent, rgba(9, 105, 218, 0.12));
}
.dg-tree-dir {
  font-weight: 600;
  cursor: default;
}
.dg-tree-arrow {
  flex-shrink: 0;
  font-size: 10px;
}
.dg-tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.dg-content-title {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  color: var(--dsw-alias-label-secondary, #656d76);
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  flex-shrink: 0;
}
.dg-content-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-secondary, #656d76);
  font-size: 12px;
  padding: 8px;
}
.dg-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  font-size: 12px;
  flex-shrink: 0;
}
.dg-detail-title {
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-detail-body { overflow: auto; padding: 8px 10px; }
.dg-meta-row { font-size: 12px; line-height: 1.7; }
.dg-meta-label { color: var(--dsw-alias-label-secondary, #656d76); }
.dg-parent-link { color: var(--dsw-alias-link-primary, #0969da); cursor: pointer; text-decoration: underline; }
.dg-parent-link:hover { text-decoration: none; }
.dg-body {
  white-space: pre-wrap;
  font-size: 12px;
  margin: 8px 0;
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-file { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 1px 0; }
.dg-file-status { font-weight: 700; flex-shrink: 0; }
.dg-file-A { color: #1a7f37; }
.dg-file-M { color: #9a6700; }
.dg-file-D { color: #d1242f; }
.dg-file-R { color: #8250df; }
/* Defensive: --diff-filter=AMDR never emits C/U today, but keep them styled
   in case a future filter change does (dark-scheme purple/orange). */
.dg-file-C { color: #8250df; }
.dg-file-U { color: #d29922; }
.dg-file-add { color: #1a7f37; }
.dg-file-del { color: #d1242f; }
.dg-file-stats { margin-left: auto; flex-shrink: 0; }

/* Side-by-side diff container (two independent scroll panes). */
.dg-diff-container {
  flex: 1 1 72%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dg-diff {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  margin: 0;
  white-space: normal;
}
.dg-diff-header {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
}
.dg-diff-header .dg-content-title {
  flex: 1 1 50%;
  min-width: 0;
  text-align: center;
  border-right: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
}
.dg-diff-header .dg-content-title:last-child {
  border-right: none;
}
/* Vertical scroll wrapper: scrolls both panes together vertically.
   The two child .dg-diff-pane each scroll independently horizontally. */
.dg-diff-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  display: flex;
}
/* Each pane (left = Before, right = After) scrolls independently
   horizontally.  Content rows inside use min-width: max-content so
   long lines widen the pane and produce its own horizontal scrollbar. */
.dg-diff-pane {
  flex: 1 1 50%;
  min-width: 0;
  /* Each pane scrolls both ways; the two panes' scroll positions are kept in
     sync by the view (aligned diff rows must stay aligned). */
  overflow-x: auto;
  overflow-y: auto;
  border-right: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
}
.dg-diff-pane:last-child {
  border-right: none;
}
/* The lines wrapper spans the pane (min-width 100%) and grows to the widest
   line, so every line's background extends to the same right edge — the full
   scroll content, not the visible pane and not the text. */
.dg-diff-lines {
  display: inline-block;
  min-width: 100%;
  vertical-align: top;
}
/* A single content line within a pane. Each row is one diff line (20px tall)
   and fills the wrapper: the background covers the whole line area (to the
   widest line's right edge), scrolling with the content. */
.dg-diff-line {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 20px;
  height: 20px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 20px;
  white-space: pre;
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-diff-add {
  background: #e6ffec;
  color: #1a7f37;
}
.dg-diff-del {
  background: #ffebe9;
  color: #d1242f;
}
.dg-diff-empty {
  background: rgba(127, 127, 127, 0.06);
  color: transparent;
}
.dg-diff-same {
  /* context line — same as base; reserved for future styling hooks. */
}

/* Raw commit-diff mode: one coloured line per row, hunk ranges tinted. */
.dg-raw-diff {
  font-size: 12px;
  margin: 8px 0;
  overflow-x: auto;
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-raw-diff .dg-diff-line { min-width: max-content; }
.dg-diff-hunk {
  background: rgba(9, 105, 218, 0.10);
  color: #0969da;
}
.dg-diff-hdr {
  color: var(--dsw-alias-label-secondary, #656d76);
}

.dg-err { color: #d1242f; font-size: 12px; padding: 8px 12px; }
.dg-err .dg-btn { margin-top: 6px; }
.dg-loading { color: var(--dsw-alias-label-secondary, #656d76); font-size: 12px; padding: 8px 12px; }
.dg-not-repo { padding: 16px 12px; font-size: 13px; }
.dg-empty { padding: 16px 12px; font-size: 13px; color: var(--dsw-alias-label-secondary, #656d76); }

/* Repo selector (side-bar pane of multi-repo workspaces; like dock-files' tree). */
.dg-repo-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
}
.dg-repo-list-hint {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #656d76);
  padding: 0 2px 6px;
}
.dg-repo-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  overflow: hidden;
}
.dg-repo-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dg-repo-item-top { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dg-repo-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-repo-path {
  color: var(--dsw-alias-label-secondary, #656d76);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-repo-depth {
  flex-shrink: 0;
  height: 16px;
  line-height: 16px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 10px;
  white-space: nowrap;
  border: 1px solid var(--dsw-alias-link-primary, #0969da);
  color: var(--dsw-alias-link-primary, #0969da);
  background: rgba(9, 105, 218, 0.08);
}
/* Depth colour coding: the workspace repo (0), subdirectories (1) and nested
   (grandchild) repos (2+) are each tinted differently so nesting level is
   readable at a glance. */
.dg-repo-depth-0 {
  border-color: #0969da;
  color: #0969da;
  background: rgba(9, 105, 218, 0.10);
}
.dg-repo-depth-1 {
  border-color: #1a7f37;
  color: #1a7f37;
  background: rgba(26, 127, 55, 0.10);
}
.dg-repo-depth-2 {
  border-color: #e16f24;
  color: #e16f24;
  background: rgba(225, 111, 36, 0.10);
}
body[data-ds-dark-theme] .dg-repo-depth-0 { border-color: #58a6ff; color: #58a6ff; background: rgba(88, 166, 255, 0.14); }
body[data-ds-dark-theme] .dg-repo-depth-1 { border-color: #3fb950; color: #3fb950; background: rgba(63, 185, 80, 0.14); }
body[data-ds-dark-theme] .dg-repo-depth-2 { border-color: #f0883e; color: #f0883e; background: rgba(240, 136, 62, 0.14); }
.dg-repo-empty {
  padding: 12px 2px;
  font-size: 13px;
  color: var(--dsw-alias-label-secondary, #656d76);
}

/* Context menu (portal to <body>, fixed; same idea as dock-files .df-context-menu). */
.dg-menu {
  position: fixed;
  z-index: 200;
  min-width: 160px;
  max-width: 280px;
  padding: 4px;
  border-radius: 8px;
  font-size: 13px;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-menu-item {
  padding: 6px 10px;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s ease;
}
.dg-menu-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dg-menu-item:active { background: var(--dsw-alias-interactive-bg-hover-accent, rgba(9, 105, 218, 0.22)); }
.dg-menu-item-danger { color: #d1242f; }
.dg-menu-item-danger:hover { background: rgba(209, 36, 47, 0.10); }
.dg-menu-divider { height: 1px; margin: 4px 8px; background: var(--dsw-alias-border-l2, #d8dbe0); }

/* Settings panel. */
.dg-settings {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 14px;
  font-size: 13px;
}
.dg-settings-section { margin-bottom: 18px; }
.dg-settings-section-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; }
.dg-settings-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 12px; }
.dg-settings-label { width: 90px; flex-shrink: 0; color: var(--dsw-alias-label-secondary, #656d76); }
.dg-settings-input {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-settings-input:focus { outline: 1px solid var(--dsw-alias-link-primary, #0969da); }
.dg-settings-remote-name-input { max-width: 120px; flex: 0 0 auto; }
.dg-settings-radio {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 14px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.dg-settings-radio input { margin: 0; cursor: pointer; }
.dg-settings-remote {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
}
.dg-settings-remote-name {
  font-weight: 600;
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-settings-remote-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary, #656d76);
}
.dg-settings-empty { font-size: 12px; padding: 4px 0; }
.dg-settings-lang { color: var(--dsw-alias-label-primary, #1f2328); }
.dg-settings-back { margin-top: 8px; }
.dg-saved { color: #1a7f37; font-size: 12px; margin-left: 6px; }

/* Dock-style modal dialog (portal to <body>, above the context menu). */
.dg-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 16vh;
}
.dg-dialog {
  min-width: 300px;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: 13px;
  overflow: hidden;
}
.dg-dialog-title {
  font-weight: 600;
  font-size: 14px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  flex-shrink: 0;
}
.dg-dialog-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  line-height: 1.6;
}
.dg-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  flex-shrink: 0;
}
.dg-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dg-dialog-label {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #656d76);
}
.dg-dialog-input,
.dg-dialog-select {
  font-size: 13px;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
}
.dg-dialog-input:focus,
.dg-dialog-select:focus {
  outline: 1px solid var(--dsw-alias-link-primary, #0969da);
}
.dg-dialog-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--dsw-alias-label-primary, #1f2328);
  white-space: nowrap;
}
.dg-dialog-check input { margin: 0; cursor: pointer; }

/* Commit panel (bottom-docked like the detail panel; VS Code style). */
.dg-commit-panel {
  flex-shrink: 0;
  max-height: 55%;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
}
.dg-commit-body {
  overflow: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dg-commit-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 2px 0;
}
.dg-commit-row-btn { margin-left: auto; flex-shrink: 0; }
.dg-commit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.dg-commit-hint { flex: 1; }
.dg-commit-msg {
  font-family: inherit;
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1f2328);
  resize: vertical;
  min-height: 56px;
  box-sizing: border-box;
}
.dg-commit-msg:focus { outline: 1px solid var(--dsw-alias-link-primary, #0969da); }
.dg-commit-btn { margin-left: auto; }
.dg-commit-empty {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #656d76);
}
.dg-commit-error {
  font-size: 12px;
  color: #d1242f;
  background: rgba(209, 36, 47, 0.08);
  border: 1px solid rgba(209, 36, 47, 0.25);
  border-radius: 5px;
  padding: 6px 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Operation result strip (ref writes). */
.dg-op-error {
  flex-shrink: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: #d1242f;
  background: rgba(209, 36, 47, 0.08);
  border-top: 1px solid rgba(209, 36, 47, 0.25);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dg-op-msg {
  flex-shrink: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: #1a7f37;
  background: rgba(26, 127, 55, 0.08);
  border-top: 1px solid rgba(26, 127, 55, 0.25);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Dark theme: fixed accents need darker-scheme values for contrast. */
body[data-ds-dark-theme] .dg-ref-head   { border-color: #3fb950; color: #3fb950; }
body[data-ds-dark-theme] .dg-ref-remote { border-color: #a371f7; color: #a371f7; }
body[data-ds-dark-theme] .dg-ref-tag    { border-color: #d29922; color: #d29922; }
body[data-ds-dark-theme] .dg-file-A, body[data-ds-dark-theme] .dg-diff-add { color: #3fb950; }
body[data-ds-dark-theme] .dg-file-M { color: #d29922; }
body[data-ds-dark-theme] .dg-file-R { color: #a371f7; }
body[data-ds-dark-theme] .dg-file-D, body[data-ds-dark-theme] .dg-diff-del { color: #ff7b72; }
body[data-ds-dark-theme] .dg-file-C { color: #a371f7; }
body[data-ds-dark-theme] .dg-file-U { color: #f0883e; }
body[data-ds-dark-theme] .dg-saved, body[data-ds-dark-theme] .dg-op-msg { color: #3fb950; }
body[data-ds-dark-theme] .dg-op-error, body[data-ds-dark-theme] .dg-menu-item-danger, body[data-ds-dark-theme] .dg-btn-danger { color: #ff7b72; }
body[data-ds-dark-theme] .dg-btn-danger { border-color: rgba(255, 123, 114, 0.45); }
body[data-ds-dark-theme] .dg-btn-danger:hover { background: rgba(255, 123, 114, 0.12); }
body[data-ds-dark-theme] .dg-menu-item-danger:hover { background: rgba(255, 123, 114, 0.12); }
body[data-ds-dark-theme] .dg-commit-error { color: #ff7b72; }
body[data-ds-dark-theme] .dg-detail-resize:hover { background: #79c0ff; }

/* Dark theme: side-by-side diff colours. The full-row backgrounds must stay
   clearly visible on dark — higher opacity than the light theme's tints. */
body[data-ds-dark-theme] .dg-diff-add { background: rgba(63, 185, 80, 0.28); color: #3fb950; }
body[data-ds-dark-theme] .dg-diff-del { background: rgba(255, 123, 114, 0.28); color: #ff7b72; }
body[data-ds-dark-theme] .dg-diff-empty { background: rgba(127, 127, 127, 0.10); }
body[data-ds-dark-theme] .dg-diff-hunk { background: rgba(56, 139, 253, 0.14); color: #79c0ff; }
body[data-ds-dark-theme] .dg-diff-hdr { color: var(--dsw-alias-label-secondary, #8b949e); }
`;
		function mountStyles() {
			const existing = document.querySelector("style[data-plugin=\"dock-git\"]");
			if (existing !== null) existing.remove();
			const style = document.createElement("style");
			style.setAttribute("data-plugin", "dock-git");
			style.textContent = CSS;
			document.head.appendChild(style);
			return () => {
				if (document.querySelector("style[data-plugin=\"dock-git\"]") === style) style.remove();
			};
		}
		//#endregion
		//#region src/client/index.ts
		/** Requires the workbench base to be mounted. */
		const inject = ["workbench"];
		/** Git branch icon (lucide git-branch, stroke style, currentColor). */
		const GIT_ICON = {
			path: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9",
			stroke: true
		};
		function apply(ctx) {
			const workbench = ctx.get("workbench");
			if (workbench === void 0) return;
			ctx.effect(() => mountStyles(), "dock-git: styles");
			ctx.effect(() => workbench.registerActivityBarItem({
				id: "git",
				title: translate(detectLocale(ctx), "graphTitle"),
				icon: GIT_ICON,
				order: 20,
				paneId: "git"
			}), "dock-git: activity item");
			ctx.effect(() => workbench.registerPanel({
				id: "git",
				region: "sideBar",
				title: () => translate(detectLocale(ctx), "repoSelectorTitle"),
				icon: GIT_ICON,
				order: 20,
				component: GitLauncher
			}), "dock-git: git launcher panel");
			ctx.effect(() => workbench.registerEditorView({
				id: GRAPH_VIEW_ID,
				title: () => translate(detectLocale(ctx), "graphTitle"),
				icon: GIT_ICON,
				order: 20,
				component: CommitView
			}), "dock-git: git history view");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map