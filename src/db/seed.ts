/**
 * 開発用シードデータ
 * 実行: bun run db:seed（事前に supabase start + bun run db:migrate）
 * 個人情報はすべて架空のもの。
 */
/* eslint-disable no-console */
import { db } from "./client";
import {
  assignments,
  companies,
  participants,
  preChecks,
  reportComments,
  reports,
  staff,
} from "./schema";

async function seed() {
  console.log("シード投入を開始します…");

  const [admin, supporter] = await db
    .insert(staff)
    .values([
      { name: "山田 太郎", email: "admin@example.com", role: "admin" },
      { name: "佐藤 花子", email: "sato@example.com", role: "staff" },
    ])
    .returning();

  const insertedParticipants = await db
    .insert(participants)
    .values([
      {
        name: "田中 一郎",
        kana: "たなか いちろう",
        email: "tanaka@example.com",
        desiredOccupations: ["事務", "軽作業"],
        skills: ["PC基本操作", "データ入力"],
        strengths: "コツコツした作業が得意",
        weaknesses: "電話対応が苦手",
        accommodations: ["静かな環境", "指示は書面で"],
        commuteConditions: "バス通勤・片道30分以内",
        assignedStaffId: supporter!.id,
      },
      {
        name: "鈴木 美咲",
        kana: "すずき みさき",
        email: "suzuki@example.com",
        preferredLanguage: "ja",
        desiredOccupations: ["接客", "清掃"],
        skills: ["接客経験あり"],
        accommodations: ["休憩を多めに"],
        needsTransport: true,
        assignedStaffId: supporter!.id,
      },
      {
        name: "グエン ヴァン アン",
        kana: "ぐえん ゔぁん あん",
        email: "nguyen@example.com",
        preferredLanguage: "vi",
        desiredOccupations: ["製造", "軽作業"],
        skills: ["フォークリフト経験"],
        accommodations: ["やさしい日本語での指示"],
        assignedStaffId: supporter!.id,
      },
    ])
    .returning();

  const insertedCompanies = await db
    .insert(companies)
    .values([
      {
        name: "株式会社グリーンオフィス",
        industry: "事務・バックオフィス",
        internshipDescription: "書類整理、データ入力、郵便物の仕分け",
        requiredSkills: ["PC基本操作"],
        supportedAccommodations: ["静かな環境", "指示は書面で", "休憩を多めに"],
        capacity: 2,
        workHours: "10:00-15:00（休憩1時間）",
        address: "東京都新宿区1-2-3",
        belongings: "筆記用具、上履き",
      },
      {
        name: "カフェ ひだまり",
        industry: "飲食・接客",
        internshipDescription: "ホール補助、食器洗浄、店内清掃",
        supportedAccommodations: ["休憩を多めに", "短時間勤務"],
        capacity: 1,
        workHours: "11:00-14:00",
        address: "東京都中野区4-5-6",
      },
      {
        name: "東都物流株式会社",
        industry: "物流・軽作業",
        internshipDescription: "ピッキング、梱包、検品",
        requiredSkills: ["立ち作業が可能なこと"],
        supportedAccommodations: ["やさしい日本語での指示", "視覚的な作業手順書"],
        capacity: 3,
        workHours: "9:00-16:00（休憩1時間）",
        address: "東京都江東区7-8-9",
      },
    ])
    .returning();

  const [assignment] = await db
    .insert(assignments)
    .values([
      {
        participantId: insertedParticipants[0]!.id,
        companyId: insertedCompanies[0]!.id,
        startDate: "2026-06-15",
        endDate: "2026-06-19",
        status: "IN_PROGRESS",
        meetingPlace: "1階受付前",
        goal: "事務作業の流れを体験し、自分に合うか確認する",
        confirmedByStaffId: admin!.id,
        confirmedAt: new Date("2026-06-08T09:00:00+09:00"),
      },
      {
        participantId: insertedParticipants[1]!.id,
        companyId: insertedCompanies[1]!.id,
        startDate: "2026-06-22",
        endDate: "2026-06-24",
        status: "CONFIRMED",
        confirmedByStaffId: admin!.id,
        confirmedAt: new Date("2026-06-10T14:00:00+09:00"),
      },
      {
        participantId: insertedParticipants[2]!.id,
        companyId: insertedCompanies[2]!.id,
        startDate: "2026-06-22",
        endDate: "2026-06-26",
        status: "DRAFT",
      },
    ])
    .returning();

  await db.insert(preChecks).values({
    assignmentId: assignment!.id,
    participantId: insertedParticipants[0]!.id,
    checkDate: "2026-06-15",
    condition: 4,
    sleep: 3,
    fatigue: 2,
    anxiety: 3,
    motivation: 4,
    canParticipate: true,
  });

  const [report] = await db
    .insert(reports)
    .values({
      assignmentId: assignment!.id,
      participantId: insertedParticipants[0]!.id,
      reportDate: "2026-06-15",
      status: "SUBMITTED",
      workDescription: "書類のファイリングとデータ入力",
      didWell: "データ入力を50件終わらせることができた",
      difficult: "ファイルの分類ルールを覚えるのが大変だった",
      satisfaction: 4,
      fatigue: 3,
      anxiety: 2,
      difficulty: 3,
      comfort: 4,
      instructionClarity: 4,
      wantsToContinue: 4,
      accommodationSufficient: true,
      freeText: "初日は緊張しましたが、担当の方が丁寧に教えてくれて安心しました。",
      clientGeneratedId: crypto.randomUUID(),
      submittedAt: new Date("2026-06-15T16:30:00+09:00"),
    })
    .returning();

  await db.insert(reportComments).values({
    reportId: report!.id,
    staffId: supporter!.id,
    body: "初日おつかれさまでした。データ入力50件は素晴らしいペースです。明日も無理せずいきましょう。",
  });

  console.log("シード投入が完了しました");
  process.exit(0);
}

seed().catch((err) => {
  console.error("シード投入に失敗しました:", err);
  process.exit(1);
});
