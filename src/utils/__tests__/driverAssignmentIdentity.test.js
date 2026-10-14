import { normalizeMyDriverAssignment } from "../jobHelpers";

describe("driver assignment identity matching", () => {
  const shivam = {
    _id: "user-shivam",
    driverProfile: { _id: "driver-shivam" },
    name: "Shivam",
    email: "shivam@example.test",
  };

  test("matches a driver profile ID when it differs from the authenticated user ID", () => {
    const assignment = normalizeMyDriverAssignment(
      {
        status: "assigned",
        driverAssignments: [
          { driverId: "driver-shivam", status: "assigned" },
        ],
      },
      shivam,
      { requireDriverMatch: true }
    );

    expect(assignment.isAssigned).toBe(true);
    expect(assignment.driverId).toBe("driver-shivam");
    expect(assignment.isPending).toBe(true);
  });

  test("does not match an assignment by a same-name driver", () => {
    const assignment = normalizeMyDriverAssignment(
      {
        myAssignment: {
          driverId: "driver-another-person",
          driverName: "Shivam",
          status: "assigned",
        },
      },
      shivam,
      { requireDriverMatch: true }
    );

    expect(assignment.isAssigned).toBe(false);
  });

  test("does not expose a legacy job assigned to a different driver", () => {
    const assignment = normalizeMyDriverAssignment(
      {
        driverId: "driver-another-person",
        status: "assigned",
      },
      shivam,
      { requireDriverMatch: true }
    );

    expect(assignment.isAssigned).toBe(false);
  });

  test("does not treat an unassigned job as this driver's assignment", () => {
    const assignment = normalizeMyDriverAssignment(
      { status: "assigned" },
      shivam,
      { requireDriverMatch: true }
    );

    expect(assignment.isAssigned).toBe(false);
  });

  test("accepts server-scoped myAssignment when its driver ID is omitted", () => {
    const assignment = normalizeMyDriverAssignment(
      {
        myAssignment: {
          status: "assigned",
          assignmentId: "assignment-shivam-146",
        },
      },
      shivam,
      { requireDriverMatch: true }
    );

    expect(assignment.isAssigned).toBe(true);
    expect(assignment.isPending).toBe(true);
  });

  test("does not inherit a completed job status into this driver's assigned session", () => {
    const assignment = normalizeMyDriverAssignment(
      {
        status: "completed",
        myAssignment: {
          driverId: "driver-shivam",
          status: "assigned",
        },
      },
      shivam,
      { requireDriverMatch: true }
    );

    expect(assignment.isAssigned).toBe(true);
    expect(assignment.isPending).toBe(true);
    expect(assignment.isInProgress).toBe(false);
    expect(assignment.isCompleted).toBe(false);
  });

  test("JOB-00146 appears for the matching driver profile and stays hidden from another driver", () => {
    const assignedJob = {
      jobNumber: "JOB-00146",
      status: "assigned",
      scheduledDate: "2026-10-17",
      driverAssignments: [
        {
          driverId: "driver-shivam",
          driverName: "Shivam",
          status: "assigned",
        },
      ],
    };
    const otherDriver = {
      _id: "user-other",
      driverProfile: { _id: "driver-other" },
      name: "Other Driver",
    };

    expect(
      normalizeMyDriverAssignment(assignedJob, shivam, {
        requireDriverMatch: true,
      }).isAssigned
    ).toBe(true);
    expect(
      normalizeMyDriverAssignment(assignedJob, otherDriver, {
        requireDriverMatch: true,
      }).isAssigned
    ).toBe(false);
  });

  test("JOB-00145 stays hidden when it has no driver assignment", () => {
    const unassignedJob = {
      jobNumber: "JOB-00145",
      status: "assigned",
      scheduledDate: "2026-10-17",
    };

    expect(
      normalizeMyDriverAssignment(unassignedJob, shivam, {
        requireDriverMatch: true,
      }).isAssigned
    ).toBe(false);
  });

  test("matches driver when currentUser.driver is an unpopulated string ID", () => {
    const stringDriverUser = {
      _id: "user-rajjeet",
      driver: "driver-67890",
      name: "Rajjeet",
    };
    const jobWithDriverId = {
      jobNumber: "JOB-00200",
      status: "assigned",
      driverAssignments: [
        {
          driverId: "driver-67890",
          status: "assigned",
        },
      ],
    };

    const assignment = normalizeMyDriverAssignment(
      jobWithDriverId,
      stringDriverUser,
      { requireDriverMatch: true }
    );
    expect(assignment.isAssigned).toBe(true);
    expect(assignment.driverId).toBe("driver-67890");
  });

  test("matches driver when currentUser has driverProfileId or driver_id", () => {
    const profileIdUser = {
      _id: "user-alex",
      driverProfileId: "profile-alex-123",
      driver_id: "driver-alex-456",
    };
    const job = {
      jobNumber: "JOB-00201",
      status: "assigned",
      driverAssignments: [
        {
          driverId: "profile-alex-123",
          status: "assigned",
        },
      ],
    };

    const assignment = normalizeMyDriverAssignment(job, profileIdUser, {
      requireDriverMatch: true,
    });
    expect(assignment.isAssigned).toBe(true);
  });
});
