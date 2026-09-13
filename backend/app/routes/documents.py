"""Admin + student document APIs."""
from __future__ import annotations

from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required

from app.admin_auth import admin_actor, admin_required
from app.documents import service as doc_svc
from app.documents.student_profile import get_enrolled_students_for_course

documents_admin_bp = Blueprint("documents_admin", __name__)
documents_student_bp = Blueprint("documents_student", __name__)

_PREVIEW_KEYS = (
    "offer-letter-technical",
    "offer-letter-non-technical",
    "id-card",
    "logbook",
    "attendance-log",
    "certificate",
)


@documents_admin_bp.route("/documents/preview", methods=["GET"])
@jwt_required()
def admin_list_document_previews():
    err = admin_required()
    if err:
        return err
    return jsonify({"previews": list(_PREVIEW_KEYS)})


@documents_admin_bp.route("/documents/preview/<sample_key>", methods=["GET"])
@jwt_required()
def admin_document_preview_pdf(sample_key: str):
    """Live PDF from our generators (mock data) — same output as Generate."""
    err = admin_required()
    if err:
        return err
    if sample_key not in _PREVIEW_KEYS:
        return jsonify({"error": "Preview not available"}), 404
    data = doc_svc.preview_pdf(sample_key)
    if not data:
        return jsonify({"error": "Preview generation failed"}), 500
    return Response(
        data,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'inline; filename="preview-{sample_key}.pdf"'},
    )


# Legacy alias — now serves live generated preview, not static docs PDFs
@documents_admin_bp.route("/documents/samples/<sample_key>", methods=["GET"])
@jwt_required()
def admin_document_sample_pdf(sample_key: str):
    return admin_document_preview_pdf(sample_key)


@documents_admin_bp.route("/documents/hub", methods=["GET"])
@jwt_required()
def admin_documents_hub():
    err = admin_required()
    if err:
        return err
    return jsonify({"counts": doc_svc.hub_counts()})


@documents_admin_bp.route("/documents/enrolled-students", methods=["GET"])
@jwt_required()
def admin_enrolled_students():
    err = admin_required()
    if err:
        return err
    course_id = (request.args.get("courseId") or "").strip()
    if not course_id:
        return jsonify({"error": "courseId required"}), 400
    students = get_enrolled_students_for_course(
        course_id,
        university=request.args.get("university"),
        college=request.args.get("college"),
        q=request.args.get("q"),
    )
    return jsonify({"students": students})


@documents_admin_bp.route("/documents/offer-letter/generate", methods=["POST"])
@jwt_required()
def admin_generate_offer_letter():
    err = admin_required()
    if err:
        return err
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    variant = (data.get("variant") or "technical").strip()
    student_ids = data.get("studentIds") or []
    inputs = data.get("inputs") or {}
    if not course_id or not student_ids:
        return jsonify({"error": "courseId and studentIds required"}), 400
    result = doc_svc.generate_offer_letters(
        course_id=course_id,
        variant=variant,
        student_ids=[str(s) for s in student_ids],
        inputs=inputs,
        actor=admin_actor(),
        app_config=current_app.config,
    )
    return jsonify(result)


@documents_admin_bp.route("/documents/id-card/generate", methods=["POST"])
@jwt_required()
def admin_generate_id_card():
    err = admin_required()
    if err:
        return err
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    variant = (data.get("variant") or "technical").strip()
    student_ids = data.get("studentIds") or []
    if not course_id or not student_ids:
        return jsonify({"error": "courseId and studentIds required"}), 400
    result = doc_svc.generate_id_cards(
        course_id=course_id,
        variant=variant,
        student_ids=[str(s) for s in student_ids],
        actor=admin_actor(),
        app_config=current_app.config,
    )
    return jsonify(result)


@documents_admin_bp.route("/documents/logbook/generate", methods=["POST"])
@jwt_required()
def admin_generate_logbook():
    err = admin_required()
    if err:
        return err
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    variant = (data.get("variant") or "technical").strip()
    student_ids = data.get("studentIds") or []
    inputs = data.get("inputs") or {}
    if not course_id or not student_ids:
        return jsonify({"error": "courseId and studentIds required"}), 400
    result = doc_svc.generate_logbooks(
        course_id=course_id,
        variant=variant,
        student_ids=[str(s) for s in student_ids],
        inputs=inputs,
        actor=admin_actor(),
        app_config=current_app.config,
    )
    return jsonify(result)


@documents_admin_bp.route("/documents/attendance-log/generate", methods=["POST"])
@jwt_required()
def admin_generate_attendance_log():
    err = admin_required()
    if err:
        return err
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    student_ids = data.get("studentIds") or []
    inputs = data.get("inputs") or {}
    if not course_id or not student_ids:
        return jsonify({"error": "courseId and studentIds required"}), 400
    result = doc_svc.generate_attendance_logs(
        course_id=course_id,
        student_ids=[str(s) for s in student_ids],
        inputs=inputs,
        actor=admin_actor(),
        app_config=current_app.config,
    )
    return jsonify(result)


@documents_admin_bp.route("/documents/certificate/generate", methods=["POST"])
@jwt_required()
def admin_generate_certificate_batch():
    err = admin_required()
    if err:
        return err
    data = request.get_json() or {}
    course_id = (data.get("courseId") or "").strip()
    variant = (data.get("variant") or "technical").strip()
    student_ids = data.get("studentIds") or []
    inputs = data.get("inputs") or {}
    if not course_id or not student_ids:
        return jsonify({"error": "courseId and studentIds required"}), 400
    result = doc_svc.generate_certificates_batch(
        course_id=course_id,
        variant=variant,
        student_ids=[str(s) for s in student_ids],
        inputs=inputs,
        actor=admin_actor(),
        app_config=current_app.config,
        with_sign=bool(data.get("withSign", True)),
    )
    return jsonify(result)


@documents_admin_bp.route("/documents/<doc_type>/manage", methods=["GET"])
@jwt_required()
def admin_manage_documents(doc_type: str):
    err = admin_required()
    if err:
        return err
    items = doc_svc.list_documents(
        doc_type=doc_type,
        course_id=request.args.get("courseId"),
        q=request.args.get("q"),
    )
    return jsonify({"items": items})


@documents_admin_bp.route("/documents/<doc_id>/download", methods=["GET"])
@jwt_required()
def admin_download_document(doc_id: str):
    err = admin_required()
    if err:
        return err
    data, name = doc_svc.get_document_pdf(doc_id)
    if not data:
        return jsonify({"error": "Document not found"}), 404
    return Response(
        data,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{name}"',
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
        },
    )


@documents_admin_bp.route("/documents/bulk-download", methods=["POST"])
@jwt_required()
def admin_bulk_download():
    err = admin_required()
    if err:
        return err
    data = request.get_json() or {}
    doc_ids = data.get("docIds") or []
    raw = doc_svc.bulk_download_zip([str(d) for d in doc_ids], with_sign=bool(data.get("withSign", True)))
    if not raw:
        return jsonify({"error": "No documents to download"}), 400
    return Response(raw, mimetype="application/zip", headers={"Content-Disposition": 'attachment; filename="documents.zip"'})


@documents_admin_bp.route("/documents/<doc_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_document(doc_id: str):
    err = admin_required()
    if err:
        return err
    if not doc_svc.delete_document(doc_id):
        return jsonify({"error": "Document not found"}), 404
    return jsonify({"ok": True})


@documents_student_bp.route("/student/documents", methods=["GET"])
@jwt_required()
def student_list_documents():
    claims = get_jwt() or {}
    if claims.get("role") not in ("student", "admin"):
        return jsonify({"error": "Student access required"}), 403
    from flask_jwt_extended import get_jwt_identity

    user_id = str(get_jwt_identity() or "")
    items = doc_svc.student_documents_list(user_id)
    return jsonify({"items": items})


@documents_student_bp.route("/student/documents/<doc_id>/download", methods=["GET"])
@jwt_required()
def student_download_document(doc_id: str):
    from flask_jwt_extended import get_jwt_identity

    user_id = str(get_jwt_identity() or "")
    from bson import ObjectId
    from app.db import get_student_documents_collection

    if not ObjectId.is_valid(doc_id):
        return jsonify({"error": "Invalid id"}), 400
    doc = get_student_documents_collection().find_one({"_id": ObjectId(doc_id), "status": "active"})
    if not doc or str(doc.get("studentId")) != user_id:
        return jsonify({"error": "Document not found"}), 404
    data, name = doc_svc.get_document_pdf(doc_id)
    if not data:
        return jsonify({"error": "File not found"}), 404
    return Response(data, mimetype="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})
