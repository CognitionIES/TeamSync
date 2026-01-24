import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface TeamLead {
  id: string;
  name: string;
  team: string[];
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface TeamsTabProps {
  teamLeads: TeamLead[];
  users: User[];
  isLoading: boolean;
}

export const TeamsTab: React.FC<TeamsTabProps> = ({
  teamLeads,
  users,
  isLoading,
}) => {
  const teamLeadMembers = new Set(teamLeads.flatMap((lead) => lead.team));
  const usersNotInTeams = users.filter((user) => !teamLeadMembers.has(user.name));

  const TeamCardSkeleton = () => (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-transparent">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 w-24 bg-gray-200 rounded mt-1 animate-pulse"></div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-4 w-28 bg-gray-200 rounded mb-2 animate-pulse"></div>
        <ul className="space-y-1 ml-1">
          {[...Array(3)].map((_, i) => (
            <li key={i} className="flex items-center gap-2 text-gray-700">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-200 animate-pulse"></span>
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Users size={18} className="text-slate-600" />
            </div>
            <div>
              <CardTitle>Team Composition</CardTitle>
              <CardDescription>
                Organization of team members and leads
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(2)].map((_, index) => (
                <TeamCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <>
              {teamLeads.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Team Leads</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {teamLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        className="border border-gray-200 bg-white shadow-sm"
                      >
                        <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-transparent">
                          <CardTitle className="text-base">{lead.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">Team Lead</p>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <h4 className="text-sm font-medium mb-2">Team Members:</h4>
                          {lead.team.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              No team members assigned.
                            </p>
                          ) : (
                            <ul className="space-y-1 ml-1">
                              {lead.team.map((member, index) => (
                                <li
                                  key={index}
                                  className="text-sm flex items-center gap-2 text-gray-700"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                                  {member}
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {usersNotInTeams.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Other Users (Not in Teams)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {usersNotInTeams.map((user) => (
                      <Card
                        key={user.id}
                        className="border border-gray-200 bg-white shadow-sm"
                      >
                        <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-transparent">
                          <CardTitle className="text-base">{user.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{user.role}</p>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {teamLeads.length === 0 && usersNotInTeams.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No users or team leads available.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};