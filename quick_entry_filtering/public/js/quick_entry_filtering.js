console.log("Quick Entry Enhancer Loaded");

(function install_quick_entry_override() {
	if (window.quick_entry_framework_loaded) {
		console.log("[QEE] already installed, skipping");
		return;
	}

	if (typeof frappe === "undefined" || !frappe.ui || !frappe.ui.form || !frappe.ui.form.QuickEntryForm) {
		console.log("[QEE] QuickEntryForm not yet defined, waiting...");
		setTimeout(install_quick_entry_override, 100);
		return;
	}

	window.quick_entry_framework_loaded = true;

	const original_render = frappe.ui.form.QuickEntryForm.prototype.render_dialog;

	frappe.ui.form.QuickEntryForm.prototype.render_dialog = function () {
		original_render.apply(this, arguments);
		setup_quick_entry_rules(this);
	};

	console.log("[QEE] QuickEntryForm.render_dialog patched");
})();

async function setup_quick_entry_rules(quick_entry) {
	console.log("[QEE] setup_quick_entry_rules for", quick_entry.doctype);

	let r;
	try {
		r = await frappe.call({
			method: "quick_entry_filtering.api.get_rules",
			args: { doctype: quick_entry.doctype },
		});
	} catch (err) {
		console.error("[QEE] API call failed:", err);
		return;
	}

	console.log("[QEE] rules response:", r && r.message);

	const rules = (r && r.message) || [];
	if (!rules.length) {
		console.log("[QEE] no active rules for", quick_entry.doctype);
		return;
	}

	rules.forEach((rule) => attach_rule(quick_entry, rule));
}

function attach_rule(quick_entry, rule) {
	console.log("[QEE] attaching rule", rule);

	const dialog = quick_entry.dialog;
	if (!dialog) {
		console.warn("[QEE] no dialog on quick_entry");
		return;
	}

	const field = dialog.get_field(rule.source_field);
	if (!field) {
		console.warn(
			"[QEE] source field not in dialog:",
			rule.source_field,
			"have:",
			Object.keys(dialog.fields_dict || {})
		);
		return;
	}

	const $input = field.$input || field.$wrapper;
	if (!$input || !$input.length) {
		console.warn("[QEE] no $input for", rule.source_field, field);
		return;
	}

	$input.off(".quick_entry_rule");

	const handler = async function () {
		const value = dialog.get_value(rule.source_field);
		console.log("[QEE] source change", rule.source_field, "=", value);

		if (!value) return;

		let res;
		try {
			res = await frappe.db.get_value(
				rule.lookup_doctype,
				value,
				rule.value_field
			);
		} catch (err) {
			console.error("[QEE] get_value failed:", err);
			return;
		}

		console.log("[QEE] get_value result:", res && res.message);

		const result = res && res.message && res.message[rule.value_field];
		if (result) {
			dialog.set_value(rule.target_field, result);
		}
	};

	$input.on("change.quick_entry_rule", handler);
	$input.on("awesomplete-selectcomplete.quick_entry_rule", handler);

	console.log("[QEE] rule attached for", rule.source_field);
}
