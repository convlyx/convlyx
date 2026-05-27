"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PRIMARY_COLOR: [number, number, number] = [22, 163, 74]; // emerald-600
const HEADER_COLOR: [number, number, number] = [21, 128, 61]; // emerald-700
const MUTED_COLOR: [number, number, number] = [113, 113, 122]; // zinc-500
const TEXT_COLOR: [number, number, number] = [24, 24, 27]; // zinc-900

let logoBase64Cache: string | null = null;

async function getLogoBase64(): Promise<string | null> {
  if (logoBase64Cache) return logoBase64Cache;
  try {
    const response = await fetch("/favicon.png");
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoBase64Cache = reader.result as string;
        resolve(logoBase64Cache);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function addHeader(doc: jsPDF, title: string, subtitle?: string, logo?: string | null) {
  // Green header bar
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, doc.internal.pageSize.width, 30, "F");

  // Logo with white rounded background
  const textStartX = logo ? 30 : 14;
  if (logo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(8, 4, 20, 20, 3, 3, "F");
    doc.addImage(logo, "PNG", 10, 6, 16, 16, undefined, "FAST");
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, textStartX, 13);

  // Subtitle
  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, textStartX, 21);
  }

  // Convlyx branding
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Convlyx", doc.internal.pageSize.width - 14, 17, { align: "right" });

  // Reset text color
  doc.setTextColor(...TEXT_COLOR);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(
      `Gerado em ${formatDate(new Date())} às ${formatTime(new Date())} · Página ${i}/${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 8,
      { align: "center" }
    );
  }
}

/**
 * Export class attendance sheet as PDF
 */
export async function exportClassAttendancePDF(classData: {
  title: string;
  classType: string;
  startsAt: string | Date;
  endsAt: string | Date;
  capacity: number;
  instructor: { name: string };
  school: { name: string };
  enrollments: Array<{
    status: string;
    notes: string | null;
    student: { name: string; email: string };
  }>;
}) {
  const doc = new jsPDF();
  const logo = await getLogoBase64();
  const startsAt = new Date(classData.startsAt);
  const endsAt = new Date(classData.endsAt);

  const typeLabel = classData.classType === "THEORY" ? "Teórica" : "Prática";
  const subtitle = `${classData.school.name} · ${formatDate(startsAt)} · ${formatTime(startsAt)} - ${formatTime(endsAt)}`;

  addHeader(doc, classData.title, subtitle, logo);

  // Class info
  let y = 38;
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_COLOR);
  doc.text("Tipo:", 14, y);
  doc.setTextColor(...TEXT_COLOR);
  doc.text(typeLabel, 45, y);

  doc.setTextColor(...MUTED_COLOR);
  doc.text("Instrutor:", 90, y);
  doc.setTextColor(...TEXT_COLOR);
  doc.text(classData.instructor.name, 120, y);

  y += 6;
  doc.setTextColor(...MUTED_COLOR);
  doc.text("Capacidade:", 14, y);
  doc.setTextColor(...TEXT_COLOR);
  doc.text(`${classData.enrollments.length}/${classData.capacity}`, 45, y);

  // Status labels
  const statusLabels: Record<string, string> = {
    ENROLLED: "Inscrito",
    ATTENDED: "Presente",
    NO_SHOW: "Faltou",
  };

  // Attendance table
  const tableData = classData.enrollments.map((e, i) => [
    String(i + 1),
    e.student.name,
    e.student.email,
    statusLabels[e.status] ?? e.status,
    e.notes ?? "",
  ]);

  autoTable(doc, {
    startY: y + 8,
    head: [["#", "Aluno", "Email", "Estado", "Notas"]],
    body: tableData,
    headStyles: {
      fillColor: PRIMARY_COLOR,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: TEXT_COLOR,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 40 },
      2: { cellWidth: 50 },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: "auto" },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);

  const fileName = `aula_${classData.title.replace(/\s+/g, "_")}_${formatDate(startsAt)}.pdf`;
  doc.save(fileName);
}

/**
 * Export student progress report as PDF
 */
export async function exportStudentProgressPDF(student: {
  name: string;
  email: string;
  phone?: string | null;
  school: { name: string };
  createdAt: string | Date;
  stats: {
    totalClasses: number;
    totalAttended: number;
    totalNoShow: number;
    theoryAttended: number;
    practicalAttended: number;
    upcoming: number;
  };
  enrollments: Array<{
    status: string;
    enrolledAt: string | Date;
    session: {
      title: string;
      classType: string;
      startsAt: string | Date;
      endsAt: string | Date;
      instructor: { name: string };
    };
  }>;
}) {
  const doc = new jsPDF();
  const logo = await getLogoBase64();

  addHeader(doc, `Relatório · ${student.name}`, student.school.name, logo);

  // Student info
  let y = 38;
  doc.setFontSize(10);

  const infoLines = [
    ["Email:", student.email],
    ...(student.phone ? [["Telefone:", student.phone]] : []),
    ["Escola:", student.school.name],
    ["Membro desde:", formatDate(new Date(student.createdAt))],
  ];

  for (const [label, value] of infoLines) {
    doc.setTextColor(...MUTED_COLOR);
    doc.text(label, 14, y);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(value, 45, y);
    y += 6;
  }

  // Stats
  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo", 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const stats = [
    ["Aulas agendadas:", String(student.stats.upcoming)],
    ["Presenças:", String(student.stats.totalAttended)],
    ["Faltas:", String(student.stats.totalNoShow)],
    ["Teóricas assistidas:", String(student.stats.theoryAttended)],
    ["Práticas assistidas:", String(student.stats.practicalAttended)],
  ];

  const totalClasses = student.stats.totalAttended + student.stats.totalNoShow;
  const attendanceRate = totalClasses > 0
    ? `${Math.round((student.stats.totalAttended / totalClasses) * 100)}%`
    : "N/A";
  stats.push(["Assiduidade:", attendanceRate]);

  for (const [label, value] of stats) {
    doc.setTextColor(...MUTED_COLOR);
    doc.text(label, 14, y);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(value, 55, y);
    y += 5;
  }

  // Class history table
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text("Histórico de aulas", 14, y);

  const statusLabels: Record<string, string> = {
    ENROLLED: "Inscrito",
    ATTENDED: "Presente",
    NO_SHOW: "Faltou",
  };

  const typeLabels: Record<string, string> = {
    THEORY: "Teórica",
    PRACTICAL: "Prática",
  };

  const tableData = student.enrollments.map((e) => {
    const startsAt = new Date(e.session.startsAt);
    const endsAt = new Date(e.session.endsAt);
    return [
      formatDate(startsAt),
      `${formatTime(startsAt)} - ${formatTime(endsAt)}`,
      e.session.title,
      typeLabels[e.session.classType] ?? e.session.classType,
      e.session.instructor.name,
      statusLabels[e.status] ?? e.status,
    ];
  });

  autoTable(doc, {
    startY: y + 4,
    head: [["Data", "Horário", "Aula", "Tipo", "Instrutor", "Estado"]],
    body: tableData,
    headStyles: {
      fillColor: PRIMARY_COLOR,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7,
      textColor: TEXT_COLOR,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 25 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 18 },
      4: { cellWidth: 30 },
      5: { cellWidth: 20, halign: "center" },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);

  const fileName = `relatorio_${student.name.replace(/\s+/g, "_")}_${formatDate(new Date())}.pdf`;
  doc.save(fileName);
}

/**
 * Export a per-course PDF report. Same vibe as the student-progress PDF but
 * scoped to a single licence category — useful when a school needs to hand
 * the student a printed summary for just Cat B (or just Cat A, etc.).
 *
 * Stats and class history are practical-only for the matching category, in
 * sync with the per-category stats on the student detail page. Exams come
 * from the course's own relation (theory + practical, both attached to
 * this course).
 */
export async function exportCourseProgressPDF({
  student,
  course,
  enrollments,
}: {
  student: {
    name: string;
    email: string;
    phone?: string | null;
    school: { name: string };
    createdAt: string | Date;
  };
  course: {
    category: string;
    status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
    startedAt: string | Date;
    completedAt: string | Date | null;
    exams: Array<{
      type: "THEORY" | "PRACTICAL";
      scheduledAt: string | Date;
      result: string;
      location: string | null;
      instructor: { name: string } | null;
    }>;
  };
  enrollments: Array<{
    status: string;
    session: {
      title: string;
      classType: string;
      category: string | null;
      startsAt: string | Date;
      endsAt: string | Date;
      instructor: { name: string };
    };
  }>;
}) {
  const doc = new jsPDF();
  const logo = await getLogoBase64();

  const courseStatusLabel: Record<typeof course.status, string> = {
    IN_PROGRESS: "Em curso",
    COMPLETED: "Concluída",
    ABANDONED: "Abandonada",
  };

  addHeader(
    doc,
    `Carta de condução ${course.category} · ${student.name}`,
    student.school.name,
    logo,
  );

  // Student + course info block
  let y = 38;
  doc.setFontSize(10);

  const infoLines: Array<[string, string]> = [
    ["Aluno:", student.name],
    ["Email:", student.email],
    ...(student.phone ? ([["Telefone:", student.phone]] as [string, string][]) : []),
    ["Categoria:", course.category],
    ["Estado:", courseStatusLabel[course.status]],
    ["Iniciada em:", formatDate(new Date(course.startedAt))],
    ...(course.completedAt
      ? ([[
          course.status === "COMPLETED" ? "Concluída em:" : "Encerrada em:",
          formatDate(new Date(course.completedAt)),
        ]] as [string, string][])
      : []),
  ];

  for (const [label, value] of infoLines) {
    doc.setTextColor(...MUTED_COLOR);
    doc.text(label, 14, y);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(value, 50, y);
    y += 6;
  }

  // Practical class stats — scoped to this category (theory is shared and
  // covered in the all-up student-progress report instead).
  const practical = enrollments.filter(
    (e) => e.session.classType === "PRACTICAL" && e.session.category === course.category,
  );
  const attended = practical.filter((e) => e.status === "ATTENDED").length;
  const missed = practical.filter((e) => e.status === "NO_SHOW").length;
  const scheduled = practical.filter((e) => e.status === "ENROLLED").length;
  const decided = attended + missed;
  const attendanceRate = decided > 0 ? `${Math.round((attended / decided) * 100)}%` : "N/A";

  const examPassed = course.exams.filter((e) => e.result === "PASSED").length;
  const examFailed = course.exams.filter((e) => e.result === "FAILED").length;
  const examScheduled = course.exams.filter((e) => e.result === "SCHEDULED").length;
  const examNoShow = course.exams.filter((e) => e.result === "NO_SHOW").length;

  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_COLOR);
  doc.text("Aulas práticas", 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const practicalStats: Array<[string, string]> = [
    ["Presenças:", String(attended)],
    ["Faltas:", String(missed)],
    ["Agendadas:", String(scheduled)],
    ["Assiduidade:", attendanceRate],
  ];
  for (const [label, value] of practicalStats) {
    doc.setTextColor(...MUTED_COLOR);
    doc.text(label, 14, y);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(value, 55, y);
    y += 5;
  }

  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Exames", 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const examStats: Array<[string, string]> = [
    ["Aprovados:", String(examPassed)],
    ["Reprovados:", String(examFailed)],
    ["Marcados:", String(examScheduled)],
    ["Faltas:", String(examNoShow)],
  ];
  for (const [label, value] of examStats) {
    doc.setTextColor(...MUTED_COLOR);
    doc.text(label, 14, y);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(value, 55, y);
    y += 5;
  }

  // Exam history table (theory + practical attached to this course).
  if (course.exams.length > 0) {
    y += 4;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Histórico de exames", 14, y);

    const examTypeLabels: Record<string, string> = { THEORY: "Teórico", PRACTICAL: "Prático" };
    const examResultLabels: Record<string, string> = {
      SCHEDULED: "Marcado",
      PASSED: "Aprovado",
      FAILED: "Reprovado",
      NO_SHOW: "Faltou",
      CANCELLED: "Cancelado",
    };

    autoTable(doc, {
      startY: y + 4,
      head: [["Data", "Tipo", "Resultado", "Local", "Instrutor"]],
      body: course.exams
        .slice()
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .map((exam) => {
          const at = new Date(exam.scheduledAt);
          return [
            `${formatDate(at)} ${formatTime(at)}`,
            examTypeLabels[exam.type] ?? exam.type,
            examResultLabels[exam.result] ?? exam.result,
            exam.location ?? "",
            exam.instructor?.name ?? "",
          ];
        }),
      headStyles: {
        fillColor: PRIMARY_COLOR,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 7, textColor: TEXT_COLOR },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: "auto" },
        4: { cellWidth: 40 },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    // Read finalY back via the autoTable plugin's last-table state. jsPDF
    // exposes it on `doc.lastAutoTable` after the table renders.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 10;
  }

  // Practical class history table — practical-only, matching category.
  y += 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Histórico de aulas práticas", 14, y);

  const statusLabels: Record<string, string> = {
    ENROLLED: "Inscrito",
    ATTENDED: "Presente",
    NO_SHOW: "Faltou",
    CANCELLED: "Cancelado",
  };

  const tableData = practical
    .slice()
    .sort(
      (a, b) =>
        new Date(a.session.startsAt).getTime() - new Date(b.session.startsAt).getTime(),
    )
    .map((e) => {
      const startsAt = new Date(e.session.startsAt);
      const endsAt = new Date(e.session.endsAt);
      return [
        formatDate(startsAt),
        `${formatTime(startsAt)} - ${formatTime(endsAt)}`,
        e.session.title,
        e.session.instructor.name,
        statusLabels[e.status] ?? e.status,
      ];
    });

  if (tableData.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Sem aulas práticas registadas para esta categoria.", 14, y + 6);
  } else {
    autoTable(doc, {
      startY: y + 4,
      head: [["Data", "Horário", "Aula", "Instrutor", "Estado"]],
      body: tableData,
      headStyles: {
        fillColor: PRIMARY_COLOR,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 7, textColor: TEXT_COLOR },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 25 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 35 },
        4: { cellWidth: 22, halign: "center" },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);

  const safeName = student.name.replace(/\s+/g, "_");
  const fileName = `relatorio_${course.category}_${safeName}_${formatDate(new Date())}.pdf`;
  doc.save(fileName);
}
