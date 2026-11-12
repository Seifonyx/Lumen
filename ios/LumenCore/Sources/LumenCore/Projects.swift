import Foundation

/// A Lumen project, as the web app keeps it: inside the account's settings (`settings.projects`), with a name,
/// instructions sent with every message in the project, and fields this app doesn't edit (files, colour,
/// default model, anything newer), which every edit here leaves exactly as they were.
public struct LumenProject: Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public var name: String
    public var instructions: String
    public var description: String?
    public var updatedAt: Double

    public init(id: String, name: String, instructions: String = "", description: String? = nil, updatedAt: Double = 0) {
        self.id = id
        self.name = name
        self.instructions = instructions
        self.description = description
        self.updatedAt = updatedAt
    }
}

public enum ProjectEdit: Sendable, Equatable {
    case create(id: String, name: String, instructions: String)
    case update(id: String, name: String, instructions: String)
    case delete(id: String)
}

public enum ProjectEditError: Error, Equatable, LocalizedError {
    case invalidName, instructionsTooLong, notFound, tooMany
    public var errorDescription: String? {
        switch self {
        case .invalidName: "Give the project a name of up to \(ProjectSettings.maximumNameLength) characters."
        case .instructionsTooLong: "Project instructions can be up to \(ProjectSettings.maximumInstructionsLength) characters."
        case .notFound: "This project was removed on another device."
        case .tooMany: "You can have up to \(ProjectSettings.maximumProjects) projects."
        }
    }
}

public enum ProjectSettings {
    public static let maximumNameLength = 60
    public static let maximumInstructionsLength = 8_000
    public static let maximumProjects = 100

    /// The projects in a settings snapshot, in the web's order. Malformed entries are skipped, never invented.
    public static func projects(from settings: [String: Any]?) -> [LumenProject] {
        guard let list = settings?["projects"] as? [Any] else { return [] }
        return list.compactMap { item in
            guard let fields = item as? [String: Any], let id = fields["id"] as? String, !id.isEmpty,
                  let name = fields["name"] as? String else { return nil }
            return LumenProject(id: id, name: name, instructions: fields["instructions"] as? String ?? "",
                                description: fields["description"] as? String,
                                updatedAt: (fields["updatedAt"] as? NSNumber)?.doubleValue ?? 0)
        }
    }

    /// The settings snapshot with one edit applied. Everything else in settings, and every field of every project
    /// that this app doesn't know about, is carried over unchanged.
    public static func apply(_ edit: ProjectEdit, to settings: [String: Any]?, now: Double) throws -> [String: Any] {
        var settings = settings ?? [:]
        var list = settings["projects"] as? [Any] ?? []
        func index(of id: String) -> Int? {
            list.firstIndex { ($0 as? [String: Any])?["id"] as? String == id }
        }
        func validated(_ name: String, _ instructions: String) throws -> (String, String) {
            let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty, name.count <= maximumNameLength else { throw ProjectEditError.invalidName }
            guard instructions.count <= maximumInstructionsLength else { throw ProjectEditError.instructionsTooLong }
            return (name, instructions)
        }
        switch edit {
        case .create(let id, let name, let instructions):
            let (name, instructions) = try validated(name, instructions)
            guard index(of: id) == nil else { return settings } // already applied (a retried save)
            guard list.count < maximumProjects else { throw ProjectEditError.tooMany }
            list.append(["id": id, "name": name, "instructions": instructions, "createdAt": now, "updatedAt": now] as [String: Any])
        case .update(let id, let name, let instructions):
            let (name, instructions) = try validated(name, instructions)
            guard let i = index(of: id), var fields = list[i] as? [String: Any] else { throw ProjectEditError.notFound }
            fields["name"] = name
            fields["instructions"] = instructions
            fields["updatedAt"] = now
            list[i] = fields
        case .delete(let id):
            guard let i = index(of: id) else { return settings } // already gone
            list.remove(at: i)
        }
        settings["projects"] = list
        return settings
    }
}

/// Moving a chat into a project (or out of one, with `projectID` nil).
public struct ProjectAssignment: Codable, Sendable, Equatable {
    public let projectID: String?
    public init(projectID: String?) { self.projectID = projectID }
}
