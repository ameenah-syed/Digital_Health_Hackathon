import SwiftUI
import Combine
import Charts

@main
struct AsthmaDashApp: App {
    @StateObject private var store = DashboardStore()

    var body: some Scene {
        WindowGroup {
            #if PATIENT_APP
            KidsCheckInView().environmentObject(store)
            #else
            ProviderDashboardView().environmentObject(store)
            #endif
        }
    }
}

// MARK: - Lightweight shared demo data

struct CheckIn: Identifiable {
    let id = UUID()
    let date: Date
    let inhalerNeeded: Bool
    let medicationTaken: Bool
    let feeling: Int
    let symptoms: [String]
    let peakFlow: Int?
    let timing: String?
    let inhalerReasons: [String]

    var feelingLabel: String { Feeling.all[feeling - 1].title }
}

struct Feeling {
    let score: Int
    let title: String
    let symbol: String
    let color: Color

    static let all: [Feeling] = [
        .init(score: 1, title: "Bad", symbol: "face.frowning.fill", color: Color(hex: 0xEB5757)),
        .init(score: 2, title: "Not great", symbol: "face.frowning", color: Color(hex: 0xF2994A)),
        .init(score: 3, title: "Okay", symbol: "face.neutral", color: Color(hex: 0xF2C94C)),
        .init(score: 4, title: "Good", symbol: "face.smiling", color: Color(hex: 0x80CF45)),
        .init(score: 5, title: "Great", symbol: "face.smiling.fill", color: Color(hex: 0x2FBF71))
    ]
}

@MainActor
final class DashboardStore: ObservableObject {
    @Published var checkIns: [CheckIn] = DashboardStore.makeDemoData()
    @Published var completedLessons: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "airwise-kids-lessons") ?? [])
    @Published var earnedBadges: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "airwise-kids-badges") ?? [])
    let patientName = "Jordan M."
    let patientID = "PT-2048"

    init() {
        refreshAchievements()
    }

    var currentStreak: Int {
        let calendar = Calendar.current
        let trackedDays = Set(checkIns.map { calendar.startOfDay(for: $0.date) })
        var day = calendar.startOfDay(for: .now)
        if !trackedDays.contains(day), let yesterday = calendar.date(byAdding: .day, value: -1, to: day) {
            day = yesterday
        }
        var streak = 0
        while trackedDays.contains(day) {
            streak += 1
            guard let previousDay = calendar.date(byAdding: .day, value: -1, to: day) else { break }
            day = previousDay
        }
        return streak
    }

    func markLessonComplete(_ id: String) {
        completedLessons.insert(id)
        UserDefaults.standard.set(Array(completedLessons), forKey: "airwise-kids-lessons")
        refreshAchievements()
    }

    private func refreshAchievements() {
        if !checkIns.isEmpty { earnedBadges.insert("first-check-in") }
        if currentStreak >= 3 { earnedBadges.insert("streak-3") }
        if currentStreak >= 7 { earnedBadges.insert("streak-7") }
        if checkIns.contains(where: { !$0.symptoms.isEmpty }) { earnedBadges.insert("symptom-spotter") }
        if completedLessons.count >= 3 { earnedBadges.insert("curious-learner") }
        UserDefaults.standard.set(Array(earnedBadges), forKey: "airwise-kids-badges")
    }

    func add(feeling: Int, inhalerNeeded: Bool, medicationTaken: Bool, symptoms: [String], timing: String?, reasons: [String], date: Date) {
        checkIns.append(CheckIn(date: date, inhalerNeeded: inhalerNeeded, medicationTaken: medicationTaken, feeling: feeling,
                               symptoms: symptoms, peakFlow: nil, timing: timing,
                               inhalerReasons: reasons))
        checkIns.sort { $0.date > $1.date }
        refreshAchievements()
    }

    private static func makeDemoData() -> [CheckIn] {
        let cal = Calendar.current
        let rows: [(Int, Bool, Bool, Int, [String], Int?, String, [String])] = [
            (0, true, true, 3, ["Coughing", "Tight chest"], 390, "During activity", ["Exercise"]),
            (1, false, true, 4, [], 420, "Morning", []),
            (2, true, false, 2, ["Wheezing"], 350, "At night", ["Cold air"]),
            (3, false, true, 5, [], 440, "No pattern", []),
            (4, true, true, 3, ["Shortness of breath"], 380, "During activity", ["Exercise", "Pollen / allergies"]),
            (5, false, true, 4, ["Coughing"], 410, "Evening", []),
            (7, true, false, 1, ["Wheezing", "Tight chest"], 320, "At night", ["Cold air"]),
            (9, false, true, 5, [], 450, "No pattern", []),
            (11, false, true, 4, [], 430, "Morning", []),
            (14, true, true, 3, ["Coughing"], 395, "During activity", ["Exercise"])
        ]
        return rows.compactMap { daysAgo, inhaler, medication, feeling, symptoms, flow, timing, reasons in
            guard let date = cal.date(byAdding: .day, value: -daysAgo, to: .now) else { return nil }
            return CheckIn(date: date, inhalerNeeded: inhaler, medicationTaken: medication, feeling: feeling,
                           symptoms: symptoms, peakFlow: flow, timing: timing,
                           inhalerReasons: reasons)
        }
    }
}

#if !PATIENT_APP
private struct SymptomCount: Identifiable {
    let name: String
    let count: Int
    var id: String { name }
}

#endif

#if !PATIENT_APP
// MARK: - Provider view

struct ProviderDashboardView: View {
    @EnvironmentObject private var store: DashboardStore
    private var latest: CheckIn? { store.checkIns.first }
    private var inhalerDays: Int { store.checkIns.prefix(7).filter(\.inhalerNeeded).count }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    patientHeader
                    latestCheckInCard
                    metricGrid
                    trendCard
                    symptomCard
                    providerPromptCard
                    triggerCard
                    checkInHistory
                    Text("Synthetic demo data • Not for clinical use")
                        .font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                        .padding(.top, 2)
                }
                .padding(20)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Asthma overview")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private var patientHeader: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(Color.cchTeal.opacity(0.13)).frame(width: 54, height: 54)
                Text("JM").font(.headline).foregroundStyle(Color.cchTeal)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(store.patientName).font(.title3.bold())
                Text("Patient ID \(store.patientID) · Asthma care")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "ellipsis").foregroundStyle(.secondary)
                .padding(10).background(.white, in: Circle())
        }
        .padding(16).background(.white, in: RoundedRectangle(cornerRadius: 20))
    }

    private var metricGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            MetricTile(title: "Feeling this week", value: feelingSummary, detail: "1 bad · 5 great", icon: "face.smiling", color: .cchTeal)
            MetricTile(title: "Inhaler needed", value: "\(inhalerDays) days", detail: "of the last 7 tracked", icon: "cross.case", color: .orange)
            MetricTile(title: "Peak flow", value: latest?.peakFlow.map { "\($0)" } ?? "—", detail: "L/min · latest reading", icon: "wind", color: .blue)
            MetricTile(title: "Days tracked", value: "\(store.checkIns.count)", detail: latest.map { "Last: \($0.date.formatted(date: .abbreviated, time: .omitted))" } ?? "No entries", icon: "calendar", color: .purple)
            MetricTile(title: "Controller meds", value: "\(store.checkIns.prefix(7).filter(\.medicationTaken).count)/7 days", detail: "Reported taken this week", icon: "pills", color: .green)
        }
    }

    private var latestCheckInCard: some View {
        Group {
            if let entry = latest {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .center) {
                        Label("Latest patient check-in", systemImage: "arrow.down.to.line.compact")
                            .font(.headline)
                        Spacer()
                        Text(entry.date.formatted(date: .omitted, time: .shortened))
                            .font(.caption.weight(.semibold)).foregroundStyle(Color.cchTeal)
                    }
                    HStack(spacing: 10) {
                        Image(systemName: Feeling.all[entry.feeling - 1].symbol)
                            .font(.title2).foregroundStyle(Feeling.all[entry.feeling - 1].color)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Feeling \(entry.feeling)/5 · \(entry.feelingLabel)").font(.subheadline.bold())
                            Text(entry.inhalerNeeded ? "Rescue inhaler needed" : "Rescue inhaler not needed")
                                .font(.caption).foregroundStyle(entry.inhalerNeeded ? .orange : .secondary)
                        }
                        Spacer()
                    }
                    Divider()
                    VStack(alignment: .leading, spacing: 8) {
                        if entry.inhalerNeeded {
                            Label("Why inhaler was needed", systemImage: "cross.case")
                                .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                            Text(entry.inhalerReasons.isEmpty ? "Reason not selected" : entry.inhalerReasons.joined(separator: " · "))
                                .font(.subheadline)
                        }
                        Label("When symptoms appear", systemImage: "clock")
                            .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Text(entry.timing ?? "Not reported")
                            .font(.subheadline)
                        Label("Symptoms", systemImage: "wind")
                            .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Text(entry.symptoms.isEmpty ? "None reported" : entry.symptoms.joined(separator: " · "))
                            .font(.subheadline)
                    }
                }
                .padding(18)
                .background(.white, in: RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.cchTeal.opacity(0.45), lineWidth: 1.5))
            }
        }
    }

    private var feelingSummary: String {
        guard let latest else { return "—" }
        return "\(latest.feeling)/5 · \(latest.feelingLabel)"
    }

    private var trendCard: some View {
        let recent = Array(store.checkIns.prefix(14).reversed())
        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Symptoms over time").font(.headline)
                    Text("Reported symptoms per check-in").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Text("Last 14")
                    .font(.caption.bold()).padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color.cchTeal.opacity(0.1), in: Capsule()).foregroundStyle(Color.cchTeal)
            }
            if recent.isEmpty {
                Text("No symptom check-ins yet").font(.subheadline).foregroundStyle(.secondary)
            } else {
                Chart(recent) { checkIn in
                    LineMark(x: .value("Date", checkIn.date), y: .value("Symptoms", checkIn.symptoms.count))
                        .interpolationMethod(.linear).foregroundStyle(Color.cchTeal)
                    PointMark(x: .value("Date", checkIn.date), y: .value("Symptoms", checkIn.symptoms.count))
                        .foregroundStyle(Color.cchTeal)
                }
                .chartYScale(domain: 0...max(3, recent.map { $0.symptoms.count }.max() ?? 0))
                .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { AxisValueLabel(format: .dateTime.weekday(.narrow)) } }
                .chartYAxis { AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) }
                .frame(height: 150)
            }
            Text("Count of symptoms selected in each patient entry").font(.caption2).foregroundStyle(.secondary)
        }
        .padding(18).background(.white, in: RoundedRectangle(cornerRadius: 20))
    }

    private var symptomCard: some View {
        let recent = store.checkIns.prefix(14).flatMap(\.symptoms)
        let counts = Dictionary(grouping: recent, by: { $0 })
            .map { SymptomCount(name: $0.key, count: $0.value.count) }
            .sorted { $0.count > $1.count }
        let colors: [Color] = [.cchTeal, .cchBlue, .cchGreen, .cchMagenta, .cchPink]
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Reported symptom mix").font(.headline)
                Spacer()
                Text("Last 14 entries").font(.caption).foregroundStyle(.secondary)
            }
            if counts.isEmpty {
                Text("No symptoms reported").font(.subheadline).foregroundStyle(.secondary)
            } else {
                HStack(spacing: 16) {
                    Chart(counts) { item in
                        SectorMark(angle: .value("Reports", item.count), innerRadius: .ratio(0.58), angularInset: 2)
                            .foregroundStyle(by: .value("Symptom", item.name))
                            .cornerRadius(4)
                    }
                    .chartLegend(.hidden)
                    .chartForegroundStyleScale(domain: counts.map(\.name), range: colors)
                    .frame(width: 138, height: 138)
                    VStack(alignment: .leading, spacing: 9) {
                        ForEach(Array(counts.enumerated()), id: \.element.id) { index, item in
                            HStack(spacing: 7) {
                                Circle().fill(colors[index % colors.count]).frame(width: 8, height: 8)
                                Text(item.name).font(.caption).lineLimit(1)
                                Spacer(minLength: 2)
                                Text("\(item.count)").font(.caption.bold()).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            Text("Counts reflect selected symptom reports, not severity.").font(.caption2).foregroundStyle(.secondary)
        }
        .padding(18).background(.white, in: RoundedRectangle(cornerRadius: 20))
    }

    private var providerPromptCard: some View {
        let recent = Array(store.checkIns.prefix(7))
        let prior = Array(store.checkIns.dropFirst(7).prefix(7))
        let recentReports = recent.reduce(0) { $0 + $1.symptoms.count }
        let priorReports = prior.reduce(0) { $0 + $1.symptoms.count }
        let recentRate = recent.isEmpty ? 0 : Double(recentReports) / Double(recent.count)
        let priorRate = prior.isEmpty ? 0 : Double(priorReports) / Double(prior.count)
        let missedMedicationEntries = recent.filter { !$0.medicationTaken }.count
        let reasonCounts = Dictionary(grouping: recent.flatMap(\.inhalerReasons), by: { $0 }).mapValues(\.count)
        let commonReason = reasonCounts.max { $0.value < $1.value }

        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Provider review prompts").font(.headline)
                Spacer()
                Text("DEMO SIGNALS").font(.system(size: 9, weight: .bold)).tracking(0.7)
                    .foregroundStyle(Color.cchTeal).padding(.horizontal, 9).padding(.vertical, 6)
                    .background(Color.cchTeal.opacity(0.1), in: Capsule())
            }
            if !prior.isEmpty {
                Label("Average symptom mentions per check-in: \(String(format: "%.2f", recentRate)) in the most recent \(recent.count) vs \(String(format: "%.2f", priorRate)) in the prior \(prior.count).", systemImage: "chart.line.flat")
                    .font(.subheadline)
            } else {
                Text("More check-ins are needed before comparing symptom patterns.").font(.subheadline)
            }
            if missedMedicationEntries > 0 {
                Label("Ask whether missed controller doses were related to access or refill timing.", systemImage: "pills")
                    .font(.subheadline)
            }
            if let commonReason {
                Label("\(commonReason.key) was the most frequently selected inhaler reason in recent entries (\(commonReason.value)).", systemImage: "wind")
                    .font(.subheadline)
            }
            Text("Retrospective patterns from synthetic data only. These are discussion prompts, not forecasts or treatment advice.")
                .font(.caption2).foregroundStyle(.secondary)
        }
        .padding(18).background(.white, in: RoundedRectangle(cornerRadius: 20))
    }

    private var checkInHistory: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Patient tracker").font(.headline)
                Spacer()
                Text("\(store.checkIns.count) entries").font(.caption).foregroundStyle(.secondary)
            }.padding(.bottom, 8)
            ForEach(store.checkIns.prefix(8)) { entry in
                HStack(spacing: 12) {
                    Text(entry.date.formatted(.dateTime.month(.abbreviated).day()))
                        .font(.caption).foregroundStyle(.secondary).frame(width: 52, alignment: .leading)
                    Image(systemName: Feeling.all[entry.feeling - 1].symbol)
                        .foregroundStyle(Feeling.all[entry.feeling - 1].color)
                    Text(entry.feelingLabel).font(.subheadline.weight(.medium)).frame(width: 82, alignment: .leading)
                    Text(entry.inhalerNeeded ? "Inhaler needed" : "No inhaler")
                        .font(.caption).foregroundStyle(entry.inhalerNeeded ? .orange : .secondary)
                    Spacer(minLength: 0)
                    Text(entry.inhalerNeeded ? entry.inhalerReasons.joined(separator: ", ") : (entry.symptoms.isEmpty ? "—" : entry.symptoms.joined(separator: ", ")))
                        .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                }
                .padding(.vertical, 11)
                if entry.id != store.checkIns.prefix(8).last?.id { Divider() }
            }
        }
        .padding(18).background(.white, in: RoundedRectangle(cornerRadius: 20))
    }

    private var triggerCard: some View {
        let reasons = store.checkIns.prefix(7).flatMap(\.inhalerReasons)
        let timings = store.checkIns.prefix(7).compactMap(\.timing)
        let reasonCounts = Dictionary(grouping: reasons, by: { $0 }).mapValues(\.count)
        let timingCounts = Dictionary(grouping: timings, by: { $0 }).mapValues(\.count)
        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Symptom patterns").font(.headline)
                Spacer()
                Text("7 days").font(.caption).foregroundStyle(.secondary)
            }
            Text("When symptoms appear").font(.caption).foregroundStyle(.secondary)
            if timingCounts.isEmpty { Text("No pattern reported").font(.subheadline).foregroundStyle(.secondary) }
            else { FlowTags(items: timingCounts.sorted { $0.value > $1.value }.map { "\($0.key) · \($0.value)" }) }
            if !reasonCounts.isEmpty {
                Divider()
                Text("Reported inhaler reasons").font(.caption).foregroundStyle(.secondary)
                FlowTags(items: reasonCounts.sorted { $0.value > $1.value }.map { "\($0.key) · \($0.value)" })
            }
        }.padding(18).background(.white, in: RoundedRectangle(cornerRadius: 20))
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let detail: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon).font(.system(size: 17, weight: .semibold))
                .foregroundStyle(color).frame(width: 34, height: 34).background(color.opacity(0.12), in: Circle())
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.system(.title3, design: .rounded, weight: .bold)).lineLimit(1).minimumScaleFactor(0.8)
            Text(detail).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15).background(.white, in: RoundedRectangle(cornerRadius: 18))
    }
}

#endif

struct FlowTags: View {
    let items: [String]
    var selectable = false
    var selected: Set<String> = []
    var onTap: ((String) -> Void)?

    var body: some View {
        ViewThatFits(in: .vertical) {
            tagLayout
            ScrollView(.horizontal, showsIndicators: false) { tagLayout }
        }
    }

    private var tagLayout: some View {
        FlexibleTagLayout(spacing: 8) {
            ForEach(items, id: \.self) { item in
                Button { withAnimation(.easeOut(duration: 0.10)) { onTap?(item) } } label: {
                    Text(item).font(.caption.weight(.medium)).padding(.horizontal, 11).padding(.vertical, 8)
                        .foregroundStyle(selected.contains(item) ? Color.white : Color.primary)
                        .background(selected.contains(item) ? Color.cchTeal : Color(uiColor: .secondarySystemGroupedBackground), in: Capsule())
                }.buttonStyle(.plain).disabled(!selectable)
            }
        }
    }
}

struct FlexibleTagLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 320
        var x: CGFloat = 0; var y: CGFloat = 0; var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > width { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            x += size.width + spacing; rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX; var y = bounds.minY; var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX { x = bounds.minX; y += rowHeight + spacing; rowHeight = 0 }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing; rowHeight = max(rowHeight, size.height)
        }
    }
}

#if PATIENT_APP
// MARK: - Kids view

private struct KidsLesson: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let detail: String
    let symbol: String
    let color: Color
    let source: URL
}

struct KidsCheckInView: View {
    @EnvironmentObject private var store: DashboardStore
    @State private var feeling = 4
    @State private var selectedSymptoms: Set<String> = []
    @State private var inhalerNeeded = false
    @State private var medicationTaken = true
    @State private var selectedReasons: Set<String> = []
    @State private var expandedLesson: String?
    @State private var showCelebration = false

    private let symptomChoices: [(String, String, Color)] = [
        ("Coughing", "lungs", .cchBlue),
        ("Wheezing", "wind", .cchTeal),
        ("Tight chest", "lungs.fill", .cchMagenta),
        ("Hard to breathe", "wind.circle.fill", .cchPink),
        ("Hard to keep playing", "figure.run", .cchGreen)
    ]
    private let reasonChoices = ["Running or playing", "Cold air", "Allergies or pollen", "Smoke or strong smells", "A cold", "I'm not sure"]
    private let lessons: [KidsLesson] = [
        .init(id: "asthma", title: "What is asthma?", subtitle: "Meet your airways", detail: "Asthma can make the small airways in your lungs swell or get tight. That can make breathing feel harder. With help from trusted adults and your care team, many kids with asthma can play, learn, and do the things they enjoy.", symbol: "lungs.fill", color: .cchBlue, source: URL(string: "https://www.nhlbi.nih.gov/health/asthma/children")!),
        .init(id: "symptoms", title: "Spot the signs", subtitle: "Your body gives clues", detail: "Coughing, a whistling sound when breathing, a tight chest, or feeling short of breath can be clues. These feelings can have other causes too. A trusted adult and your healthcare team can help figure out what they mean.", symbol: "eye.fill", color: .cchMagenta, source: URL(string: "https://www.nhlbi.nih.gov/health/asthma/symptoms")!),
        .init(id: "diagnosis", title: "How do doctors know?", subtitle: "You are part of the team", detail: "A doctor or nurse asks about your health and listens to you breathe. They may use a breathing test, too. One symptom by itself does not tell you whether you have asthma. Only your healthcare team can diagnose asthma.", symbol: "stethoscope", color: .cchTeal, source: URL(string: "https://www.nhlbi.nih.gov/health/asthma/diagnosis")!),
        .init(id: "care-plan", title: "My asthma helper plan", subtitle: "Make it with an adult", detail: "Your personal asthma action plan is made with your healthcare team. It tells you and your adults which medicines to use and what to do when symptoms happen. Ask a trusted adult to help you follow your own plan. This app cannot make or change that plan.", symbol: "map.fill", color: .cchGreen, source: URL(string: "https://www.nhlbi.nih.gov/health/asthma/treatment-action-plan")!)
    ]

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    welcomeCard
                    KidsStreakCalendar(entries: store.checkIns, streak: store.currentStreak)
                    feelingPicker
                    symptomPicker
                    inhalerCard
                    medicationCard
                    saveButton
                    trophyShelf
                    learningLibrary
                    safetyCard
                    Text("Demo app · Check in with an adult · Not medical advice")
                        .font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.vertical, 5)
                }
                .padding(16)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("My Asthma Buddy")
            .navigationBarTitleDisplayMode(.inline)
            .overlay(alignment: .top) {
                if showCelebration {
                    KidsCelebrationToast(streak: store.currentStreak)
                        .padding(.horizontal, 20).padding(.top, 8)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .zIndex(1)
                }
            }
        }
    }

    private var welcomeCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(Color.cchBlue.opacity(0.13)).frame(width: 68, height: 68)
                Image(systemName: "lungs.fill").font(.system(size: 34, weight: .medium)).foregroundStyle(Color.cchTeal)
                Image(systemName: "sparkle").font(.system(size: 16, weight: .bold)).foregroundStyle(Color.cchPink).offset(x: 26, y: -24)
            }
            VStack(alignment: .leading, spacing: 5) {
                Text("Hi, breathing buddy!").font(.title3.bold())
                Text("How is your body feeling today?").font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(16).background(.white, in: RoundedRectangle(cornerRadius: 22))
    }

    private var feelingPicker: some View {
        VStack(alignment: .leading, spacing: 11) {
            kidsSectionTitle("How are you feeling?", subtitle: "Pick the face that feels most like you.", icon: "face.smiling")
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: 5), spacing: 7) {
                ForEach(Feeling.all, id: \.score) { item in
                    Button { feeling = item.score } label: {
                        VStack(spacing: 7) {
                            Image(systemName: item.symbol).font(.system(size: 28, weight: .medium))
                            Text(item.title).font(.system(size: 9, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
                        }
                        .foregroundStyle(item.color)
                        .frame(maxWidth: .infinity, minHeight: 75)
                        .background(feeling == item.score ? item.color.opacity(0.13) : Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 15))
                        .overlay(RoundedRectangle(cornerRadius: 15).stroke(feeling == item.score ? item.color : .clear, lineWidth: 1.5))
                    }.buttonStyle(.plain).accessibilityLabel("Feeling: \(item.title)")
                }
            }
        }.padding(15).background(.white, in: RoundedRectangle(cornerRadius: 21))
    }

    private var symptomPicker: some View {
        VStack(alignment: .leading, spacing: 11) {
            kidsSectionTitle("What did your body feel?", subtitle: "Tap any pictures that match. It is okay to pick none.", icon: "hand.tap.fill")
            LazyVGrid(columns: columns, spacing: 9) {
                ForEach(symptomChoices, id: \.0) { name, symbol, color in
                    KidsPictureChoice(title: name, symbol: symbol, color: color, selected: selectedSymptoms.contains(name)) {
                        if !selectedSymptoms.insert(name).inserted { selectedSymptoms.remove(name) }
                    }
                }
            }
        }.padding(15).background(.white, in: RoundedRectangle(cornerRadius: 21))
    }

    private var inhalerCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            kidsSectionTitle("Did you need your rescue inhaler?", subtitle: "Ask an adult to help you follow your own plan.", icon: "cross.case.fill")
            HStack(spacing: 9) {
                KidsPictureChoice(title: "No", symbol: "hand.thumbsup.fill", color: .cchGreen, selected: !inhalerNeeded) { inhalerNeeded = false }
                KidsPictureChoice(title: "Yes", symbol: "wind", color: .cchBlue, selected: inhalerNeeded) { inhalerNeeded = true }
            }
            if inhalerNeeded {
                Text("What might have been happening? Choose any.").font(.caption.weight(.medium)).foregroundStyle(.secondary).padding(.top, 3)
                FlexibleTagLayout(spacing: 7) {
                    ForEach(reasonChoices, id: \.self) { reason in
                        Button {
                            if !selectedReasons.insert(reason).inserted { selectedReasons.remove(reason) }
                        } label: {
                            Label(reason, systemImage: selectedReasons.contains(reason) ? "checkmark.circle.fill" : "circle")
                                .font(.caption.weight(.medium)).foregroundStyle(selectedReasons.contains(reason) ? Color.cchTeal : Color.secondary)
                                .padding(.horizontal, 10).padding(.vertical, 8)
                                .background(selectedReasons.contains(reason) ? Color.cchTeal.opacity(0.1) : Color(uiColor: .secondarySystemGroupedBackground), in: Capsule())
                        }.buttonStyle(.plain)
                    }
                }
            }
        }.padding(15).background(.white, in: RoundedRectangle(cornerRadius: 21))
    }

    private var medicationCard: some View {
        VStack(alignment: .leading, spacing: 11) {
            kidsSectionTitle("Daily medicine check", subtitle: "Did you take your controller medicine with an adult?", icon: "pills.fill")
            HStack(spacing: 9) {
                KidsPictureChoice(title: "Yes", symbol: "checkmark.circle.fill", color: .cchGreen, selected: medicationTaken) { medicationTaken = true }
                KidsPictureChoice(title: "Not today", symbol: "circle", color: .cchPink, selected: !medicationTaken) { medicationTaken = false }
            }
        }.padding(15).background(.white, in: RoundedRectangle(cornerRadius: 21))
    }

    private var saveButton: some View {
        Button(action: saveCheckIn) {
            Label("Save my check-in", systemImage: "sparkles")
                .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 16)
                .foregroundStyle(.white).background(Color.cchTeal, in: RoundedRectangle(cornerRadius: 17))
        }.buttonStyle(.plain)
    }

    private var trophyShelf: some View {
        VStack(alignment: .leading, spacing: 12) {
            kidsSectionTitle("My trophy shelf", subtitle: "You earn badges for checking in and learning.", icon: "trophy.fill")
            LazyVGrid(columns: columns, spacing: 9) {
                trophy(title: "First check-in", detail: "You got started!", icon: "star.fill", color: .cchBlue, earned: store.earnedBadges.contains("first-check-in"))
                trophy(title: "3-day streak", detail: "Three days in a row", icon: "flame.fill", color: .cchPink, earned: store.earnedBadges.contains("streak-3"))
                trophy(title: "7-day streak", detail: "A whole week", icon: "rosette", color: .cchMagenta, earned: store.earnedBadges.contains("streak-7"))
                trophy(title: "Symptom spotter", detail: "You shared a body clue", icon: "eye.fill", color: .cchTeal, earned: store.earnedBadges.contains("symptom-spotter"))
                trophy(title: "Curious learner", detail: "Read 3 mini-lessons", icon: "book.closed.fill", color: .cchGreen, earned: store.earnedBadges.contains("curious-learner"))
            }
            Text("Badges celebrate showing up, not having symptoms or taking medicine. Miss a day? Your badges stay right here.")
                .font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }.padding(15).background(.white, in: RoundedRectangle(cornerRadius: 21))
    }

    private var learningLibrary: some View {
        VStack(alignment: .leading, spacing: 11) {
            kidsSectionTitle("Little learning corner", subtitle: "Tap a picture to learn more.", icon: "book.fill")
            ForEach(lessons) { lesson in
                VStack(spacing: 0) {
                    Button {
                        withAnimation(.easeOut(duration: 0.16)) {
                            expandedLesson = expandedLesson == lesson.id ? nil : lesson.id
                        }
                    } label: {
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 14).fill(lesson.color.opacity(0.13)).frame(width: 48, height: 48)
                                Image(systemName: lesson.symbol).font(.system(size: 22, weight: .medium)).foregroundStyle(lesson.color)
                            }
                            VStack(alignment: .leading, spacing: 3) {
                                Text(lesson.title).font(.subheadline.bold()).foregroundStyle(.primary)
                                Text(lesson.subtitle).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if store.completedLessons.contains(lesson.id) {
                                Image(systemName: "checkmark.seal.fill").foregroundStyle(Color.cchGreen)
                            } else {
                                Image(systemName: expandedLesson == lesson.id ? "chevron.up" : "chevron.down").font(.caption.bold()).foregroundStyle(.secondary)
                            }
                        }.contentShape(Rectangle())
                    }.buttonStyle(.plain)
                    if expandedLesson == lesson.id {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(lesson.detail).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                            Link(destination: lesson.source) {
                                Label("Learn more with an adult", systemImage: "arrow.up.right.square")
                                    .font(.caption.weight(.semibold)).foregroundStyle(Color.cchTeal)
                            }
                            Button { store.markLessonComplete(lesson.id) } label: {
                                Label(store.completedLessons.contains(lesson.id) ? "Lesson badge earned" : "I learned this!", systemImage: store.completedLessons.contains(lesson.id) ? "checkmark.seal.fill" : "star.fill")
                                    .font(.caption.bold()).foregroundStyle(Color.cchTeal)
                                    .padding(.horizontal, 12).padding(.vertical, 9)
                                    .background(Color.cchTeal.opacity(0.09), in: Capsule())
                            }.buttonStyle(.plain)
                        }.padding(.top, 11).frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(12).background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 17))
            }
        }.padding(15).background(.white, in: RoundedRectangle(cornerRadius: 21))
    }

    private var safetyCard: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "person.fill.questionmark").font(.title2).foregroundStyle(Color.cchPink)
            VStack(alignment: .leading, spacing: 5) {
                Text("Need help right now?").font(.subheadline.bold())
                Text("Tell an adult right away if breathing feels very hard. Follow your own asthma action plan together. If it is an emergency, your adult should call 911.")
                    .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }.padding(15).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.cchPink.opacity(0.11), in: RoundedRectangle(cornerRadius: 19))
    }

    private func kidsSectionTitle(_ title: String, subtitle: String, icon: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon).font(.system(size: 18, weight: .semibold)).foregroundStyle(Color.cchTeal).frame(width: 27)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(subtitle).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func trophy(title: String, detail: String, icon: String, color: Color, earned: Bool) -> some View {
        VStack(spacing: 6) {
            Image(systemName: earned ? icon : "lock.fill").font(.system(size: 23, weight: .semibold))
                .foregroundStyle(earned ? color : Color.gray.opacity(0.45))
                .frame(width: 48, height: 48).background((earned ? color : Color.gray).opacity(0.11), in: Circle())
            Text(title).font(.caption.bold()).multilineTextAlignment(.center).foregroundStyle(earned ? .primary : .secondary)
            Text(earned ? "Earned!" : detail).font(.system(size: 9)).multilineTextAlignment(.center).foregroundStyle(.secondary).lineLimit(2)
        }
        .frame(maxWidth: .infinity, minHeight: 106).padding(8)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 15))
        .accessibilityElement(children: .combine)
    }

    private func saveCheckIn() {
        store.add(feeling: feeling, inhalerNeeded: inhalerNeeded, medicationTaken: medicationTaken,
                  symptoms: Array(selectedSymptoms), timing: nil, reasons: Array(selectedReasons), date: .now)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) { showCelebration = true }
        Task {
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            withAnimation(.easeOut(duration: 0.2)) { showCelebration = false }
        }
        selectedSymptoms = []
        selectedReasons = []
        inhalerNeeded = false
    }
}

private struct KidsPictureChoice: View {
    let title: String
    let symbol: String
    let color: Color
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: symbol).font(.system(size: 27, weight: .medium)).foregroundStyle(color)
                    .frame(height: 34)
                Text(title).font(.caption.weight(.semibold)).multilineTextAlignment(.center).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: 76)
            .padding(8)
            .background(selected ? color.opacity(0.12) : Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(selected ? color : .clear, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title)\(selected ? ", selected" : "")")
    }
}

private struct KidsStreakCalendar: View {
    let entries: [CheckIn]
    let streak: Int
    @State private var visibleMonth = Calendar.current.startOfDay(for: .now)
    private let calendar = Calendar.current
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 3), count: 7)

    private var trackedDays: Set<Date> { Set(entries.map { calendar.startOfDay(for: $0.date) }) }
    private var monthDays: [Date?] {
        guard let interval = calendar.dateInterval(of: .month, for: visibleMonth),
              let numberOfDays = calendar.range(of: .day, in: .month, for: visibleMonth) else { return [] }
        let offset = calendar.component(.weekday, from: interval.start) - 1
        let dates = (0..<numberOfDays.count).compactMap { calendar.date(byAdding: .day, value: $0, to: interval.start) }
        return Array(repeating: nil, count: offset) + dates.map(Optional.some) + Array(repeating: nil, count: max(0, 42 - offset - dates.count))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 13) {
                ZStack {
                    Circle().fill(Color.cchPink.opacity(0.14)).frame(width: 49, height: 49)
                    Image(systemName: "flame.fill").font(.system(size: 24)).foregroundStyle(Color.cchPink)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(streak) day\(streak == 1 ? "" : "s")").font(.system(.title2, design: .rounded, weight: .bold))
                    Text("check-in streak").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "star.circle.fill").font(.system(size: 29)).foregroundStyle(Color.cchGreen)
            }
            Divider()
            HStack {
                Text(visibleMonth.formatted(.dateTime.month(.wide).year())).font(.subheadline.bold())
                Spacer()
                Button { moveMonth(-1) } label: { Image(systemName: "chevron.left.circle.fill").font(.title3).foregroundStyle(Color.cchBlue) }.buttonStyle(.plain).accessibilityLabel("Previous month")
                Button { moveMonth(1) } label: { Image(systemName: "chevron.right.circle.fill").font(.title3).foregroundStyle(Color.cchBlue) }.buttonStyle(.plain).accessibilityLabel("Next month")
            }
            LazyVGrid(columns: columns, spacing: 5) {
                ForEach(["S", "M", "T", "W", "T", "F", "S"].indices, id: \.self) { index in
                    Text(["S", "M", "T", "W", "T", "F", "S"][index]).font(.caption2.bold()).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                }
                ForEach(Array(monthDays.enumerated()), id: \.offset) { _, date in
                    if let date {
                        let tracked = trackedDays.contains(calendar.startOfDay(for: date))
                        ZStack {
                            Circle().fill(tracked ? Color.cchGreen.opacity(0.16) : .clear)
                            if tracked { Image(systemName: "checkmark").font(.system(size: 10, weight: .heavy)).foregroundStyle(Color.cchGreen) }
                            Text(date.formatted(.dateTime.day())).font(.system(size: 10, weight: tracked ? .bold : .regular))
                                .foregroundStyle(tracked ? Color.cchGreen : Color.primary.opacity(0.75))
                        }
                        .frame(height: 30)
                        .overlay(Circle().stroke(calendar.isDateInToday(date) ? Color.cchBlue : .clear, lineWidth: 1.5))
                        .accessibilityLabel("\(date.formatted(date: .complete, time: .omitted))\(tracked ? ", check-in tracked" : "")")
                    } else {
                        Color.clear.frame(height: 30)
                    }
                }
            }
            Label("Green checkmarks show days you checked in.", systemImage: "checkmark.circle.fill")
                .font(.caption2).foregroundStyle(Color.cchGreen)
            Text("Missed a day? Your badges stay. Start a new streak whenever you are ready.")
                .font(.caption2).foregroundStyle(.secondary)
        }
        .padding(15).background(.white, in: RoundedRectangle(cornerRadius: 21))
    }

    private func moveMonth(_ value: Int) {
        if let date = calendar.date(byAdding: .month, value: value, to: visibleMonth) { visibleMonth = date }
    }
}

private struct KidsCelebrationToast: View {
    let streak: Int
    private let colors: [Color] = [.cchGreen, .cchBlue, .cchTeal, .cchMagenta, .cchPink]

    var body: some View {
        ZStack {
            HStack(spacing: 11) {
                Image(systemName: "party.popper.fill").font(.title2).foregroundStyle(Color.cchMagenta)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Check-in complete!").font(.subheadline.bold())
                    Text("You showed up for yourself. This demo check-in is saved in this app.").font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "star.fill").foregroundStyle(Color.cchGreen)
            }
            .padding(15).background(.white, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.cchGreen.opacity(0.35), lineWidth: 1))
            ForEach(0..<10, id: \.self) { index in
                Capsule().fill(colors[index % colors.count]).frame(width: 4, height: 9)
                    .rotationEffect(.degrees(Double(index * 37)))
                    .offset(x: CGFloat((index % 5) * 74 - 145), y: index.isMultiple(of: 2) ? -36 : 36)
                    .allowsHitTesting(false)
            }
        }
        .shadow(color: .black.opacity(0.12), radius: 12, y: 5)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Check-in complete. You showed up for yourself. Current streak: \(streak) days.")
    }
}

#endif

extension Color {
    static let cchGreen = Color(hex: 0x37AD67)
    static let cchBlue = Color(hex: 0x36A9DB)
    static let cchTeal = Color(hex: 0x078B8C)
    static let cchMagenta = Color(hex: 0xA64A9C)
    static let cchPink = Color(hex: 0xE56C9A)
    static let cchGray = Color(hex: 0x56616B)

    init(hex: UInt) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255, opacity: 1)
    }
}
