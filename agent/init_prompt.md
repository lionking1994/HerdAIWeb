user: user to run this logic

get user [email], meeting title and description
find the user from [users] table based on his 'email'
find his coworkers [id]s from [users] table - coworker if email is in the same domain e.g. matt@herd.ai and thomas@herd.ai are coworkers
find all [meeting_id]s from [meeting_participants] table which his coworkers and he attended
Let's say all meeting_id array as "meeting_ids"

tables

users
id, name, email

meeting_participants
user_id, meeting_id, role (this value is Null or 'organizer')

meetings
id, title, transcription_link (actually, this is a transcription text), 

tasks
id, meeting_id, assigned_id, title, description, status (this value is Pending [default value], Assigned, In Progress, Completed, Rated), rate, review

# as to task, if a user completes the task, its status is Completed. And then the reviewer set review and rate. rate is 1 - 5 and 5 is good and 1 is bad. When set the review, the status of task is Rated
When a task is created, its status is set to “Pending.”
When the task is assigned to a team member, the status changes to “Assigned.”
When the member begins working on the task, the status becomes “In Progress.”
When the task is completed, the status changes to “Completed.”
After the task owner reviews it, the status is updated to “Rated.”

Therefore, the final status is “Rated.”

So what I need is;

The array meeting_ids contains meetings I attended and I didnt attend.

As for each meeting_id, I need
{
    id,
    title,
    transcription_link,
    datetime,
    meeting_participants: [ // this is an array of just only coworkers attended the meeting
        {
            user_id,
            role,
            tasks: [ // this is an array of tasks which assigned to this coworker in this meeting
                {
                    title,
                    description,
                    status,
                    rate,
                    review
                }
            ]
        }
    ],
    is_attended: true or false // this is true if I attended the meeting
}


database is postgreSQL
Host : agentherd.cluster-calhzheieug0.us-east-1.rds.amazonaws.com
Port : 5432
DB : agentherddb
USER : postgres
Password : =UldZ9T2P=ykqpC6HE1?9AtZ-V!qhAQn