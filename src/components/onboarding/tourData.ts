export interface TourPage {
  title: string;
  description: string[];
  image?: string;
}

export const tourPages: TourPage[] = [
  {
    title: "Welcome to Racket Arena",
    description:[
      "Manage badminton sessions with automatic and fair matchmaking."],
    image: "/logo.png"
  },
  {
    title: "Create a Session",
    description:[
      "Create a badminton session with its date, location, and details."],
    image: "/tour/club_session.png",
  },
  {
    title: "Add and Rate Players",
    description:[
      "Add players to your club and rate their skill level"],
    image: "/tour/club_members.png",
  },
  {
    title: "Manage Attendance",
    description:[
      "Confirm players to include them in your queueing session."],
    image: "/tour/attendance.png",
  },
  {
    title: "Queue: Manage Court ",
    description:[
        "Rename courts to your preference.",
      "1 - Add courts to play on. ",
      "2 - Forfeit and invalidate the match. ",
      "3 - End Match and record the results. ",
      "4 - Remove Court button to rename the court."],
    image: "/tour/queue_courts.png",
  },
  {
    title: "Queue: Generate Balanced Matches",
    description:[
      "Racket Arena creates balanced teams based on waiting time, games played, and player skill. ",
      "1 - Generate and make balanced matches. ",
      "2 - Shuffle the players in the roster. ",
      "3 - Delete delete the roster and start over. ",
      "4 - Assign the players in the roster to the available courts.",
      "Click the desired player to change in the roster and pick a replacement player."],
    image: "/tour/queue_match.png",
  },
  {
    title: "Queue: Manual Pick",
    description:[
      "Pick four players to create matches manually. ",
      "Pick two players and Press Generate to find the best match for them."],
          image: "/tour/queue_manual.png",
  },
  {
    title: "Queue: Players Section",
    description:[
      "Shows the Players' Status. ",
      "Players are ordered based on Games Played, and Waiting Score. ",
      "⌚ Waiting Score - is a combination of average waiting time and current waiting time.",
      "⏱ Current Waiting Time - is the time the player has been waiting since its last match.",
    "Skill Level is marked as S1-S7, where S1 is Newbie and S7 is Elite."],
          image: "/tour/queue_players.png",
  },
  {
    title: "See Rankings",
    description:[
      "Show the players' rankings based on their game score."],
          image: "/tour/ranking.png",
  },
  {
    title: "Access Match History",
    description:[
      "Shows the list of games completed in that queueing session.",
    "Can also search for a specific player to see their match history."],
          image: "/tour/history.png",
  },
  {
    title: "Manage Payments",
    description:[
      "Helps you calculate the amount to be collected",
      "And Track the payments of each player and the total amount collected."],
          image: "/tour/payment.png",
  },
];