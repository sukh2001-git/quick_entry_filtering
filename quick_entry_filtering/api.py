import frappe


@frappe.whitelist()
def get_rules(doctype):

    return frappe.get_all(
        "Quick Entry Rule",
        filters={
            "is_active": 1,
            "target_doctype": doctype
        },
        fields=["*"]
    )