import Foundation

/// What a message asks for, read from its text and attachments (a Swift port of the web's `analyze`).
public struct RouteTask: Equatable, Sendable {
    public var image = false
    public var code = false
    public var reasoning = false
    public var writing = false
    public var arabic = false
    public var long = false
    public var quick = false
}

/// Auto's choice for one message: the model, the next ones to try if it fails, and why it was picked.
public struct RoutePlan: Equatable, Sendable {
    public let model: AIModel
    public let fallbacks: [AIModel]
    public let reason: String
}

/// "Auto" picks the best of the user's connected models for each message, as on the web: it reads the task, scores
/// every model that can handle it, keeps the scarce large models for heavy work, alternates providers among the
/// backups, and says why it chose. Deterministic: the same message and models give the same plan.
public enum AutoRouter {
    public static func analyze(text: String, hasImage: Bool, conversationCharacters: Int) -> RouteTask {
        let lower = text.lowercased()
        // Words match from the start of a word ("api" must not match "capital"), so stems such as "summar"
        // still cover "summary" and "summarise".
        func has(_ words: [String]) -> Bool {
            words.contains { word in
                lower.range(of: #"(^|[^\p{L}\p{N}])"# + NSRegularExpression.escapedPattern(for: word), options: .regularExpression) != nil
            }
        }
        var task = RouteTask()
        task.image = hasImage
        task.code = text.contains("```") || has(["code", "function", "bug", "error", "stack trace", "compile", "swift", "python",
                                                  "javascript", "typescript", "sql", "regex", "api", "refactor", "class ", "html", "css"])
        task.reasoning = has(["step by step", "prove", "proof", "solve", "calculate", "math", "equation", "derive", "logic",
                              "plan ", "strategy", "analy", "compare", "why does", "why is"])
        task.writing = has(["write", "rewrite", "essay", "email", "letter", "story", "poem", "translate", "summar", "edit my",
                            "proofread", "paraphrase", "اكتب", "ترجم", "لخص"]) || (!task.code && text.count > 600)
        task.arabic = text.unicodeScalars.contains { (0x0600...0x06FF).contains($0.value) || (0x0750...0x077F).contains($0.value) }
        task.long = conversationCharacters > 120_000
        task.quick = !task.image && !task.code && !task.reasoning && !task.writing && !task.long && text.count < 280
        return task
    }

    struct Traits { let power: Int; let fast: Bool; let gemini: Bool; let gemma: Bool; let coder: Bool; let reasoner: Bool }

    static func traits(_ model: AIModel) -> Traits {
        let name = (model.name + " " + model.id).lowercased()
        let params = name.range(of: #"(?:^|[-/:._ ])(\d{1,4}(?:\.\d)?)b(?=[-/:._ ]|$)"#, options: .regularExpression)
            .flatMap { Double(name[$0].filter { $0.isNumber || $0 == "." }) } ?? 0
        let strong = name.range(of: #"(^|[-/:. ])(pro|ultra|large|max|opus)([-.: ]|$)"#, options: .regularExpression) != nil || params >= 65
        let light = name.range(of: #"(^|[-/:._ ])(lite|mini|nano|small|tiny|haiku|flash-lite)([-/:._ ]|$)"#, options: .regularExpression) != nil
            || (params > 0 && params < 20)
        return Traits(power: strong ? 3 : light ? 1 : 2,
                      fast: model.providerId == "groq" || model.providerId == "cerebras",
                      gemini: model.providerId == "gemini" && !name.contains("gemma"),
                      gemma: name.contains("gemma"),
                      coder: name.range(of: "coder|codestral|devstral|code", options: .regularExpression) != nil,
                      reasoner: name.range(of: #"reason|think|(^|[-/ ])(r1|o1|o3|o4|qwq)([-/ ]|$)|deepseek-r"#, options: .regularExpression) != nil)
    }

    static func score(_ model: AIModel, task: RouteTask, index: Int, total: Int, previous: Bool) -> Double {
        let t = traits(model)
        var s = total > 0 ? Double(total - index) / Double(total) * 1.6 : 0 // the user's own order breaks ties
        let heavy = task.code || task.reasoning || task.long
        s += t.power == 1 ? 1 : 2
        if t.power == 3 { s += heavy ? 1.5 : -1 } // large models have the smallest free limits
        if task.image { s += model.supportsImages ? 4 : -50 }
        if task.code { s += (t.coder ? 4 : 0) + (t.gemini ? 1 : 0) }
        if task.reasoning { s += t.reasoner ? 3 : 0 }
        if task.arabic { s += t.gemini ? 2 : t.gemma ? 1 : 0 }
        if task.quick {
            s += (t.power == 1 ? 2 : t.power == 2 ? 1.5 : -2) + (t.fast ? 1.5 : 0)
            if t.coder { s -= 2 }
            if t.reasoner && !t.gemini && !t.fast { s -= 2 }
        }
        if task.writing { s += (t.power >= 2 ? 1 : 0) + (t.gemini ? 1 : 0) + (task.arabic && t.gemini ? 1 : 0) }
        if task.writing && !task.code && t.coder { s -= 2 }
        if previous { s += 1 } // continuity among close matches
        return s
    }

    /// The plan for one message, or nil when no connected model can handle it (for example a photo and no model
    /// that reads images).
    public static func plan(text: String, hasImage: Bool, conversationCharacters: Int, models: [AIModel],
                            previousModelID: String? = nil) -> RoutePlan? {
        let task = analyze(text: text, hasImage: hasImage, conversationCharacters: conversationCharacters)
        let capable = models.filter { !task.image || $0.supportsImages }
        guard !capable.isEmpty else { return nil }
        var scored = capable.enumerated().map { (offset, model) in
            (model: model, score: score(model, task: task, index: offset, total: capable.count, previous: model.id == previousModelID))
        }
        scored.sort { $0.score > $1.score }
        // Backups alternate providers when close in score, so one provider's outage or limit doesn't take out the
        // next attempts too.
        var ranked: [AIModel] = []
        var rest = scored
        while !rest.isEmpty {
            var pick = 0
            if let last = ranked.last?.providerId, rest[0].model.providerId == last {
                for at in rest.indices.dropFirst() where rest[at].score >= rest[0].score - 2.5 {
                    if rest[at].model.providerId != last { pick = at; break }
                }
            }
            ranked.append(rest.remove(at: pick).model)
        }
        let model = ranked[0]
        let t = traits(model)
        let reason: String
        if task.image { reason = "reads images" }
        else if task.long { reason = "handles long conversations" }
        else if task.code && (t.coder || t.power == 3 || t.gemini) { reason = "good at code" }
        else if task.reasoning && t.reasoner { reason = "thinks step by step" }
        else if task.arabic && (t.gemini || t.gemma) { reason = "strong in Arabic" }
        else if task.writing && t.power >= 2 { reason = "strong writer" }
        else if task.quick { reason = t.fast ? "very fast for quick replies" : "fast for quick replies" }
        else { reason = "best match among your models" }
        return RoutePlan(model: model, fallbacks: Array(ranked.dropFirst().prefix(2)), reason: reason)
    }
}
