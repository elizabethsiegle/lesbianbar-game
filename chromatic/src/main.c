#include <gb/gb.h>
#include <gb/cgb.h>
#include <stdint.h>
#include <string.h>
#include "assets.h"

enum { TITLE, MASK, WORLD, DIALOG, SHIFT, ENDING, INITIALS, BOARD, HELP, TALLY, CREDITS };
enum { BAR, ZOOM, SCHOOL };
enum { INTRO, OPEN_CALL, QUEST, POLICY, READY, INCIDENT, BOSS, RESULT, FINISH };
enum { ACCESS, TICKETS, NOTES, CLOWNS, TRIVIA };

typedef struct { uint16_t score; char initials[3]; uint8_t ending, mask; } ScoreEntry;
typedef struct { uint8_t x, y, kind, active, age; } Visitor;
typedef struct { uint8_t x, y, active; } Paper;

uint8_t state, location, phase, px, py, face, profit, trust, chaos, stamina;
uint8_t mask_base, mask_color, mask_pattern, mask_accessory, mask_row;
uint8_t quests[5], finds, clown_ties, retreat, ending_id, boss_round, committee;
uint8_t selection, menu_count, dialog_action, quest_id, dialog_page, dialog_pages, dialog_pos;
uint8_t dialog_lines, input_previous, move_wait, paused, vibe, cooldown[2], served;
uint8_t initials_pos, initials[3], sound_on = 1, board_from_game;
uint16_t points, final_score, clock_frames, shift_frames, total_frames, tally_value;
int16_t last_delta;
uint8_t shift_seconds, spawned, resolved, escalated;
Visitor visitors[3];
Paper papers[3];
ScoreEntry board[5];
char wrapped[24][19];
const char *menu[4];
char speaker[19];
const uint8_t max_stamina[] = {5,3,1,0};
const uint8_t mask_rows[] = {7,8,9,10,12};
const int16_t quest_penalties[] = {-250,-300,-250,-200,-200};
const char *mask_names[] = {"N95", "CLOTH", "NOVELTY", "NO MASK"};
const char *pattern_names[] = {"PLAIN", "FLANNEL", "DOTS", "RAINBOW"};
const char *accessory_names[] = {"NONE", "PATCH", "CLOWN NOSE"};
const char *ending_names[] = {"THE COMPROMISE", "CLOWN ANNEX", "NATIONALLY VIRAL", "THE SUBCOMMITTEE"};
const char *place_names[] = {"LAST DITCH BAR", "ROOMMATE'S ZOOM", "CLOWN SCHOOL"};
const uint16_t palettes[] = {
  RGB(4,4,7),RGB(10,8,13),RGB(18,13,16),RGB(30,28,23),
  RGB(4,4,7),RGB(13,8,7),RGB(18,12,9),RGB(29,20,13),
  RGB(4,4,7),RGB(7,12,11),RGB(13,18,13),RGB(22,25,17),
  RGB(4,4,7),RGB(17,8,10),RGB(25,13,8),RGB(30,23,13),
  RGB(4,4,7),RGB(10,8,13),RGB(20,11,17),RGB(29,17,21),
  RGB(4,4,7),RGB(5,5,8),RGB(30,23,16),RGB(24,13,17),
  RGB(4,4,7),RGB(5,5,8),RGB(30,23,16),RGB(15,23,27),
  RGB(4,4,7),RGB(5,5,8),RGB(30,23,16),RGB(22,25,17)
};
const uint16_t mask_colors[] = {RGB(15,23,27),RGB(22,25,17),RGB(29,17,21),RGB(30,23,13)};
const uint16_t notes_cozy[] = {1546,1630,1715,1630,1750,1715,1630,1546};
const uint16_t notes_clown[] = {1715,1810,1750,1546,1810,1715,1750,1546};
const uint16_t notes_tense[] = {1546,1574,1546,1460,1574,1546,1460,1380};
const uint16_t notes_boss[] = {1546,1546,1715,1750,1630,1715,1810,1750};

void draw_world(void);
void draw_title(void);
void draw_mask(void);
void show_board(uint8_t from_game);
void show_dialog(const char *name, const char *body, uint8_t action, uint8_t count,
                 const char *a, const char *b, const char *c, const char *d);
void start_shift(void);
void finish_game(void);
void draw_initials(void);

void tile(uint8_t x, uint8_t y, uint8_t value, uint8_t palette) {
  VBK_REG = 1; set_bkg_tile_xy(x,y,palette);
  VBK_REG = 0; set_bkg_tile_xy(x,y,value);
}
void fill(uint8_t x,uint8_t y,uint8_t w,uint8_t h,uint8_t value,uint8_t palette) {
  uint8_t i,j;
  for(j=y;j<y+h;j++) for(i=x;i<x+w;i++) tile(i,j,value,palette);
}
uint8_t glyph(uint8_t c) {
  if(c>='a'&&c<='z')c-=32;
  return c>=32&&c<96?c-32:31;
}
void text(uint8_t x,uint8_t y,const char *value,uint8_t palette) {
  while(*value && x<20) tile(x++,y,glyph((uint8_t)*value++),palette);
}
void number(uint8_t x,uint8_t y,uint16_t value,uint8_t digits,uint8_t palette) {
  char s[6]; uint8_t i=digits; s[i]=0;
  do { s[--i]=(char)('0'+value%10);value/=10; } while(i);
  text(x,y,s,palette);
}
void hide_actors(void) { uint8_t i; for(i=0;i<16;i++) move_sprite(i,0,0); }
void clear_screen(void) { hide_actors(); fill(0,0,20,18,0,0); }
void footer(const char *a,const char *b) { fill(0,14,20,4,0,0);text(1,14,a,7);text(1,15,b,0);text(1,16,"D-PAD MOVE + BUMP",0);text(1,17,state==WORLD?"SELECT: TRAVEL":"START: PAUSE",4); }
void sfx(uint8_t bad) {
  if(!sound_on)return;
  NR21_REG=0x80;NR22_REG=bad?0x92:0xA1;NR23_REG=bad?0x35:0xC0;NR24_REG=0xC6;
}
void music(void) {
  uint16_t note;uint8_t i;
  if(!sound_on||paused||total_frames%16)return;
  i=(uint8_t)((total_frames/16)%8);
  if(state==SHIFT||(state==DIALOG&&dialog_action==INCIDENT))note=notes_boss[i];
  else if(state==DIALOG&&dialog_action==POLICY)note=notes_tense[i];
  else note=location==ZOOM||location==SCHOOL?notes_clown[i]:notes_cozy[i];
  NR10_REG=0;NR11_REG=0x80;NR12_REG=0x61;NR13_REG=(uint8_t)note;NR14_REG=0x80|(note>>8);
  if(i%2==0){NR31_REG=0;NR32_REG=0x60;NR33_REG=(uint8_t)(note-250);NR34_REG=0x80|((note-250)>>8);}
}
uint8_t meter(uint8_t value,int8_t delta) { int16_t n=(int16_t)value+delta;return n<0?0:n>100?100:(uint8_t)n; }
void award(int16_t amount,int8_t p,int8_t t,int8_t c) {
  int16_t n=(int16_t)points+amount; points=n<0?0:n>7500?7500:(uint16_t)n;
  last_delta=amount;profit=meter(profit,p);trust=meter(trust,t);chaos=meter(chaos,c);sfx(amount<0);
}
void callout(uint8_t count) {
  if(stamina>=count)stamina-=count;
  else{count-=stamina;stamina=0;award(-(int16_t)count*75,0,-2*count,2*count);}
}
void hud(void) {
  uint8_t i;
  fill(0,0,20,3,0,0);
  tile(0,0,T_COIN,3);number(1,0,profit,3,0);
  tile(7,0,T_HEART,4);number(8,0,trust,3,0);
  tile(14,0,T_BOLT,3);number(15,0,chaos,3,0);
  text(0,1,"PTS",7);number(4,1,points,5,0);
  for(i=0;i<5;i++)tile(11+i,1,i<stamina?T_HEART:13,i<stamina?7:0);
  for(i=0;i<18;i++)tile(i+1,2,i<phase*3?29:13,i<phase*3?7:0);
}
void owner(void) {
  uint8_t i;uint16_t offset=((uint16_t)mask_base*12+mask_pattern*3+mask_accessory)*64;
  uint16_t colors[4]={RGB(4,4,7),RGB(5,5,8),RGB(30,23,16),0};
  colors[3]=mask_colors[mask_color];set_sprite_palette(0,1,colors);
  set_sprite_data(0,4,&owners[offset]);
  for(i=0;i<4;i++){set_sprite_tile(i,i);set_sprite_prop(i,i<2?0:1);}
}
void move_owner(void) {
  move_sprite(0,px*8+8,py*8+16);move_sprite(1,px*8+16,py*8+16);
  move_sprite(2,px*8+8,py*8+24);move_sprite(3,px*8+16,py*8+24);
}
void actor(uint8_t kind,uint8_t x,uint8_t y) {
  uint8_t t=T_ACTOR+kind*4;
  tile(x,y,t,kind==1?4:6);tile(x+1,y,t+1,kind==1?4:6);
  tile(x,y+1,t+2,kind==1?4:5);tile(x+1,y+1,t+3,kind==1?4:5);
}
void scene(void) {
  uint8_t x,y;
  hide_actors();fill(0,3,20,11,T_FLOOR,location==SCHOOL?2:1);
  fill(0,3,20,2,T_WALL,location==SCHOOL?4:2);
  for(x=1;x<20;x+=2)tile(x,3,T_LIGHT,3);
  if(location==BAR){
    text(5,4,"LAST DITCH",0);text(15,4,"OPEN",4);
    fill(2,5,16,1,T_COUNTER,1);tile(1,5,T_LEAF,3);tile(18,5,T_LEAF,3);
    for(x=3;x<18;x+=4)tile(x,8,T_STOOL,1);
    actor(0,5,6);actor(3,14,6);actor(4,8,10);
  }else if(location==ZOOM){
    for(y=5;y<11;y+=3)for(x=3;x<18;x+=6){fill(x,y,4,3,T_WALL,4);actor((x+y)%6,x+1,y);}
    text(2,4,"CLOWN SCHOOL ZOOM",4);actor(1,5,6);actor(2,14,6);tile(10,11,T_MUSIC,3);
  }else{
    text(3,4,"APPLIED HONKING",4);
    actor(1,5,6);actor(1,14,6);actor(1,8,10);
    for(x=3;x<18;x+=4)tile(x,9,T_STOOL,4);
    tile(10,11,T_PAPER,3);
  }
  tile(0,11,T_DOOR,2);tile(18,11,T_DOOR,2);
  text(0,12,location==BAR?"ZOOM": "BAR",7);
  text(14,12,location==SCHOOL?"ZOOM":"SCHOOL",7);
}
void draw_world(void) {
  state=WORLD;scene();hud();owner();move_owner();
  footer(place_names[location],phase==1?"GO TO ZOOM HOST":phase==2?"QUESTS OR ZOOM VOTE":"BUMP TO INTERACT");
}
void wrap(const char *body) {
  uint8_t row=0,col=0,len,i;const char *end;
  memset(wrapped,0,sizeof(wrapped));
  while(*body){
    while(*body==' ')body++;
    if(!*body)break;
    end=body;while(*end&&*end!=' ')end++;len=(uint8_t)(end-body);
    if(col&&col+len+1>18){if(row==23)break;row++;col=0;}
    if(col)wrapped[row][col++]=' ';
    for(i=0;i<len&&col<18;i++)wrapped[row][col++]=body[i];
    body=end;
  }
  dialog_lines=row+1;dialog_pages=(dialog_lines+4)/5;dialog_page=0;dialog_pos=0;
}
uint8_t page_length(void) {
  uint8_t i,n=0;for(i=0;i<5&&dialog_page*5+i<dialog_lines;i++)n+=(uint8_t)strlen(wrapped[dialog_page*5+i]);return n;
}
void draw_dialog(void) {
  uint8_t i,j,n=0;
  fill(0,7,20,11,0,0);text(1,7,speaker,7);
  for(i=0;i<5&&dialog_page*5+i<dialog_lines;i++){
    const char *line=wrapped[dialog_page*5+i];
    for(j=0;line[j];j++){if(n++<dialog_pos)tile(j+1,i+8,glyph(line[j]),0);}
  }
  if(dialog_pos>=page_length()){
    if(dialog_page+1==dialog_pages&&menu_count){
      for(i=0;i<menu_count;i++){text(1,13+i,i==selection?">":" ",4);text(2,13+i,menu[i],i==selection?7:0);}
      text(1,17,"UP/DOWN A CHOOSE",0);
    }else text(1,17,"A / RIGHT CONTINUE",0);
  }else text(1,17,"A REVEAL TEXT",0);
}
void reveal_character(void) {
  uint8_t i,j,n=0;
  for(i=0;i<5&&dialog_page*5+i<dialog_lines;i++)
    for(j=0;wrapped[dialog_page*5+i][j];j++)
      if(++n==dialog_pos){tile(j+1,i+8,glyph(wrapped[dialog_page*5+i][j]),0);return;}
}
void show_dialog(const char *name,const char *body,uint8_t action,uint8_t count,
                 const char *a,const char *b,const char *c,const char *d) {
  hide_actors();strncpy(speaker,name,18);speaker[18]=0;
  menu[0]=a;menu[1]=b;menu[2]=c;menu[3]=d;menu_count=count;selection=0;dialog_action=action;
  wrap(body);state=DIALOG;hud();draw_dialog();
}
void result(const char *body) { show_dialog(last_delta<0?"POINTS LOST":"POINTS EARNED",body,RESULT,0,0,0,0,0); }
void save_board(void) {
  uint8_t i,sum=0;volatile uint8_t *ram=(volatile uint8_t *)0xA000;
  const uint8_t *data=(const uint8_t *)board;
  ENABLE_RAM;SWITCH_RAM(0);
  for(i=0;i<sizeof(board);i++){ram[8+i]=data[i];sum+=data[i];}
  ram[0]='L';ram[1]='D';ram[2]=1;ram[3]=sum;DISABLE_RAM;
}
void load_board(void) {
  uint8_t i,sum=0,valid=1;volatile uint8_t *ram=(volatile uint8_t *)0xA000;uint8_t *data=(uint8_t *)board;
  ENABLE_RAM;SWITCH_RAM(0);
  if(ram[0]!='L'||ram[1]!='D'||ram[2]!=1)valid=0;
  for(i=0;i<sizeof(board);i++){data[i]=ram[8+i];sum+=data[i];}
  if(sum!=ram[3])valid=0;
  DISABLE_RAM;
  for(i=0;i<5;i++)if(board[i].score>10500||board[i].ending>3||board[i].mask>3)valid=0;
  if(!valid)memset(board,0,sizeof(board));
}
void draw_title(void) {
  state=TITLE;location=BAR;clear_screen();selection=0;
  fill(2,4,16,7,T_WALL,2);fill(3,7,14,4,T_COUNTER,1);
  text(5,1,"LAST DITCH",3);text(2,2,"WESTERN MASS SAGA",7);text(5,5,"LESBIAN BAR",0);
  for(uint8_t x=3;x<18;x+=2)tile(x,4,T_LIGHT,3);
  tile(4,8,T_WINDOW,3);tile(15,8,T_WINDOW,3);tile(9,9,T_DOOR,2);
  text(7,7,"OPEN",4);tile(1,9,T_LEAF,3);tile(18,9,T_LEAF,3);
  text(2,12,"> PLAY",7);text(2,13,"  LOCAL SCORES",0);text(2,14,"  HOW TO PLAY",0);
  text(2,16,"EVERYONE BELONGS",7);text(2,17,"A / START TO BEGIN",0);
}
void new_game(void) {
  profit=40;trust=50;chaos=25;points=500;stamina=0;phase=0;
  mask_base=0;mask_color=0;mask_pattern=0;mask_accessory=0;mask_row=0;
  finds=0;clown_ties=0;retreat=0;committee=0;boss_round=0;served=0;paused=0;
  memset(quests,0,sizeof(quests));location=BAR;scene();
  show_dialog("TESS / RENT SUNDAY","A COVID-conscious lesbian bar in Greenfield eases one mask rule. The queer community splinters. You are also attending clown school. Keep the bar alive.",INTRO,0,0,0,0,0);
}
void draw_mask(void) {
  uint8_t i;state=MASK;clear_screen();hud();text(2,4,"DRESS FOR DISCOURSE",4);
  px=2;py=7;owner();move_owner();
  text(6,6,"BASE",0);text(6,7,mask_names[mask_base],7);
  text(6,8,"COLOR",0);number(13,8,mask_color+1,1,7);
  text(6,9,pattern_names[mask_pattern],7);text(6,10,accessory_names[mask_accessory],7);
  text(6,12,"DONE / JOIN TOWN",7);
  for(i=0;i<5;i++)text(5,mask_rows[i],mask_row==i?">":" ",4);
  text(1,14,mask_base==0?"N95: 5 STAMINA":mask_base==1?"CLOTH: 3 / TRUST+10":mask_base==2?"NOVELTY:1 / HONK+":"NO MASK: MOVE FAST",7);
  text(1,16,"UP/DOWN ROW",0);text(1,17,"LEFT/RIGHT A NEXT",0);
}
void visit_quest(uint8_t id) {
  if(quests[id]){footer(place_names[location],"DONE. GO TO ZOOM.");sfx(0);return;}
  quest_id=id;
  if(id==ACCESS)show_dialog("WILLOW / ACCESS","I need a masked hour and a clear patio route. The town surveyed my feelings six times. Nobody moved the chairs.",QUEST,2,"MOVE CHAIRS +350","SURVEY AGAIN -250",0,0);
  if(id==TICKETS)show_dialog("TESS / THE RENT","Likes cannot pay rent. Neither can the grant for an immersive mask discourse. Shall we sell tickets?",QUEST,2,"SELL TICKETS +350","HONKCOIN -300",0,0);
  if(id==NOTES)show_dialog("NORA / THE GLOBE","One more question: what changed? I have the bar, the masks, and the clown school. I need a fact.",QUEST,2,"CHECK NOTES +400","CRYING=RIGHT -250",0,0);
  if(id==CLOWNS)show_dialog("DOTTIE / FACULTY","Our benefit show has a mime landlord. You guys all have seven sisters? Sorry. Wrong rehearsal.",QUEST,2,"REHEARSE +350","ADD 87 SLIDES -200",0,0);
  if(id==TRIVIA)show_dialog("RUTH / REGULAR","Is trivia still on? I studied rivers. Also which local institution survived three recessions? This bar.",QUEST,2,"INVITE FOLKS +350","CANCEL TRIVIA -200",0,0);
}
void host(void) {
  if(phase==1)show_dialog("DOTTIE / ZOOM HOST","Before I began mediating, meetings took 5-6 hours. Now they only take 4. Your roommate's clown school Zoom link has an unmuted tuba.",OPEN_CALL,3,"ONE MIC +250","HONK QUORUM +100","READ CHAT -250",0);
  else show_dialog("SATURDAY POLICY","The rent is real. So are access needs. Pick a plan you can deliver tonight. The poll is no longer a soundboard.",POLICY,3,"PATIO + HOUR +350","MASKS STAY +200","CLOWN SCHOOL +100",0);
}
void bump(uint8_t x,uint8_t y) {
  if(x==0&&y>=10){location=location==BAR?ZOOM:BAR;px=2;py=10;draw_world();return;}
  if(x>=18&&y>=10){location=location==SCHOOL?ZOOM:SCHOOL;px=2;py=10;draw_world();return;}
  if(location==BAR){if(x>=5&&x<=6&&y>=6&&y<=7)visit_quest(TICKETS);else if(x>=14&&x<=15&&y>=6&&y<=7)visit_quest(ACCESS);else if(x>=8&&x<=9&&y>=10&&y<=11)visit_quest(TRIVIA);}
  else if(location==ZOOM){
    if(x>=5&&x<=6&&y>=6&&y<=7)host();
    else if(x>=14&&x<=15&&y>=6&&y<=7)visit_quest(NOTES);
    else if(x==10&&y==11){if(!(finds&1)){finds|=1;award(100,0,2,-2);result("The tuba unmutes to say thank you. +100. A productive exchange.");}else footer(place_names[location],"TUBA ALREADY MUTED");}
  }else{
    if(x>=5&&x<=6&&y>=6&&y<=7)visit_quest(CLOWNS);
    else if(x==10&&y==11){if(!(finds&2)){finds|=2;award(150,0,2,0);result("Certificate in Applied Honking. +150. Very real committee energy.");}else footer(place_names[location],"HONORS ALREADY EARNED");}
    else show_dialog("CLOWN STUDENT","Everyone agrees with you, why are you doing this? Honk respectfully.",RESULT,0,0,0,0,0);
  }
}
uint8_t is_object(uint8_t x,uint8_t y) {
  if(x==0||x>=18)return 1;
  if((x>=5&&x<=6&&y>=6&&y<=7)||(x>=14&&x<=15&&y>=6&&y<=7))return 1;
  if(location!=ZOOM&&x>=8&&x<=9&&y>=10&&y<=11)return 1;
  if(location!=BAR&&x==10&&y==11)return 1;
  return 0;
}
void start_shift(void) {
  uint8_t i;phase=4;state=SHIFT;location=retreat?SCHOOL:BAR;scene();
  fill(2,6,16,8,T_FLOOR,location==BAR?1:2);tile(3,11,T_SNACK,3);tile(16,11,T_MUSIC,4);
  px=9;py=10;owner();move_owner();
  shift_frames=0;clock_frames=0;shift_seconds=60;spawned=0;resolved=0;escalated=0;vibe=70;
  memset(visitors,0,sizeof(visitors));memset(papers,0,sizeof(papers));memset(cooldown,0,sizeof(cooldown));
  for(i=0;i<3;i++){papers[i].x=4+i*5;papers[i].y=8;papers[i].active=1;set_sprite_data(8,1,&tiles[T_PAPER*16]);set_sprite_tile(8+i,8);set_sprite_prop(8+i,2);}
  hud();footer("SAVE 9 MIX-UPS","SNACK / DANCE HELP");
}
void incident(uint8_t index) {
  const char *body;quest_id=index;
  switch(visitors[index].kind){
    case 0:body="Two petitions want opposite things. Both use the same clipboard. Someone requests a clipboard subcommittee.";break;
    case 1:body="A confused clown mistakes Saturday for finals. The assignment is falling down while remaining insured.";break;
    case 2:body="Nora from the Boston Globe has another question. Are these comments all customers, or inside a clown car?";break;
    default:body="Reply-all paperwork is taking over the bar. The printer prints a petition against printing petitions.";break;
  }
  show_dialog(visitors[index].kind==2?"NORA / FOLLOW-UP":"SATURDAY MIX-UP",body,INCIDENT,2,"USE A PLAN +350","MAKE A MEME -200",0,0);
}
void boss(void) {
  phase=5;location=ZOOM;scene();
  if(boss_round==0)show_dialog("MARLOW / LISTSERV","Everyone agrees with you, why are you doing this? Marlow proposes extending the meeting forever.",BOSS,2,"POST RECEIPTS +350","87 MORE SLIDES -200",0,0);
  if(boss_round==1)show_dialog("NORA / LAST QUESTION","Just because you're crying doesn't mean you're right. Your editor? No. My roommate. What can I verify?",BOSS,2,"FACTS +350","400 CUSTOMERS -250",0,0);
  if(boss_round==2)show_dialog("DOTTIE / ADJOURN","The regulars need their bar. The clowns need a stage. Do we adjourn, enroll, or become a committee?",BOSS,3,"ADJOURN +350","CLOWN DEGREE +150","COMMITTEE -200",0);
}
void choose_dialog(void) {
  uint8_t action=dialog_action;
  if(action==INTRO){draw_mask();return;}
  if(action==OPEN_CALL){
    if(selection==0)award(250,0,5,-8);
    else if(selection==1){award(100,2,1,8);clown_ties++;callout(1);}
    else{award(-250,-3,-4,10);callout(2);}
    phase=2;result("The call has an agenda. Optional quests: Willow for access, Tess for rent, Nora for facts. Bump the host again to vote and start Saturday.");return;
  }
  if(action==QUEST){
    quests[quest_id]=selection==0?1:2;
    if(selection==0){award(quest_id==NOTES?400:350,quest_id==TICKETS?15:0,8,-5);if(quest_id==CLOWNS)clown_ties+=2;
      result(quest_id==ACCESS?"Route cleared. Masked hours posted. The plan fits on the door. +350.":quest_id==TICKETS?"Real tickets. Real money. Tess marks PAID. The most erotic thing this week. +350.":quest_id==NOTES?"The Globe has facts, not just discourse. Nora closes one of her three notebooks. +400.":quest_id==CLOWNS?"The mime landlord loses to a balloon union. Benefit rehearsed. +350.":"Ruth brings the regulars. Every team answers THIS BAR. +350.");
    }else{award(quest_penalties[quest_id],-4,-6,10);callout(1);result("The room politely requests a practical plan. Points lost. This quest is finished; other people still need help.");}return;
  }
  if(action==POLICY){
    if(selection==0&&quests[ACCESS]!=1){result("A patio promise needs a real route. Help Willow at the bar, or choose another policy.");return;}
    if(selection==0)award(350,3,12,-10);
    else if(selection==1)award(200,-5,10,-7);
    else{award(100,-4,3,-3);retreat=1;clown_ties+=2;}
    phase=3;show_dialog("SATURDAY / 60 SEC","Bump the 9 arrivals before their bars empty. Helpful plans earn 350; escalations lose 200. Dodge paperwork. Snacks and line dances recharge you.",READY,0,0,0,0,0);return;
  }
  if(action==READY){start_shift();return;}
  if(action==INCIDENT){
    Visitor *v=&visitors[quest_id];v->active=0;resolved++;
    if(selection==0){award(350,4,3,-4);vibe=meter(vibe,8);if(v->kind==2&&quests[NOTES]==1)award(100,0,2,-2);if(v->kind==1&&quests[CLOWNS]==1)award(mask_base==2?150:75,2,1,0);}
    else{award(-200,1,-5,10);vibe=meter(vibe,-8);callout(1);}
    scene();fill(2,6,16,8,T_FLOOR,location==BAR?1:2);tile(3,11,T_SNACK,3);tile(16,11,T_MUSIC,4);
    state=SHIFT;hud();move_owner();return;
  }
  if(action==BOSS){
    if(selection==0)award(boss_round==1&&quests[NOTES]!=1?150:350,3,6,-7);
    else if(boss_round==2&&selection==1){award(150,1,3,4);retreat=1;}
    else{award(-200,-3,-5,10);callout(1);if(boss_round==2)committee=1;}
    boss_round++;if(boss_round<3)boss();else finish_game();return;
  }
  if(action==RESULT){draw_world();return;}
  if(action==FINISH){state=INITIALS;initials[0]=0;initials[1]=0;initials[2]=0;initials_pos=0;draw_initials();return;}
}
void input_dialog(uint8_t pressed) {
  uint8_t length=page_length();
  if((pressed&J_B)&&dialog_action==QUEST){draw_world();return;}
  if(dialog_pos<length){if(pressed){dialog_pos=length;draw_dialog();}return;}
  if(dialog_page+1<dialog_pages){if(pressed&(J_A|J_RIGHT|J_START)){dialog_page++;dialog_pos=0;draw_dialog();}return;}
  if(menu_count&&pressed&(J_UP|J_DOWN)){selection=(selection+(pressed&J_UP?menu_count-1:1))%menu_count;sfx(0);draw_dialog();return;}
  if(pressed&(J_A|J_RIGHT|J_START))choose_dialog();
}
void move(uint8_t keys,uint8_t arcade_mode) {
  int8_t nx=px,ny=py;uint8_t i;
  if(keys&J_UP)ny--;else if(keys&J_DOWN)ny++;else if(keys&J_LEFT)nx--;else if(keys&J_RIGHT)nx++;else return;
  if(nx<0||nx>18||ny<6||ny>11)return;
  if(!arcade_mode&&(nx==0||nx==18)&&ny<10)return;
  if(!arcade_mode){if(is_object(nx,ny)){bump(nx,ny);return;}}
  else{
    for(i=0;i<3;i++)if(visitors[i].active&&(uint8_t)nx==visitors[i].x&&(uint8_t)ny==visitors[i].y){incident(i);return;}
    if(ny==11&&(nx==3||nx==16)){i=nx==3?0:1;if(!cooldown[i]){cooldown[i]=8;vibe=meter(vibe,15);if(stamina<max_stamina[mask_base])stamina++;chaos=meter(chaos,-3);sfx(0);hud();}return;}
    if(nx<2||nx>16)return;
  }
  px=(uint8_t)nx;py=(uint8_t)ny;move_owner();
}
void update_shift(void) {
  uint8_t i,j;clock_frames++;shift_frames++;
  if(shift_frames==60){
    shift_frames=0;if(shift_seconds)shift_seconds--;
    for(i=0;i<2;i++)if(cooldown[i])cooldown[i]--;
    vibe=meter(vibe,-2);
    for(i=0;i<3;i++)if(visitors[i].active){visitors[i].age++;if(visitors[i].age==12){award(-100,-2,-2,5);escalated++;}if(visitors[i].age==18){visitors[i].active=0;fill(visitors[i].x,visitors[i].y,2,3,T_FLOOR,location==BAR?1:2);}}
    if(vibe<20)award(-25,-1,-1,1);
    hud();fill(0,14,20,4,0,0);text(1,14,"SATURDAY",4);number(12,14,shift_seconds,2,0);text(15,14,"SEC",0);
    text(1,15,"VIBE",7);number(6,15,vibe,3,0);text(11,15,"SAVES",7);number(17,15,resolved,1,0);
    text(1,16,"SNACKS / LINE DANCE",0);text(1,17,"START PAUSES",0);
  }
  if(clock_frames%360==60&&spawned<9){
    for(i=0;i<3;i++)if(!visitors[i].active){visitors[i].active=1;visitors[i].age=0;visitors[i].x=3+(spawned*5)%13;visitors[i].y=6+(spawned%4);visitors[i].kind=(spawned+(quests[CLOWNS]==1?1:0))%4;spawned++;break;}
  }
  for(i=0;i<3;i++)if(visitors[i].active){actor(visitors[i].kind==1?1:visitors[i].kind==2?2:4,visitors[i].x,visitors[i].y);for(j=0;j<2;j++)tile(visitors[i].x+j,visitors[i].y+2,visitors[i].age<12?29:13,visitors[i].age<8?7:4);}
  if(clock_frames%10==0){
    for(i=0;i<3;i++){papers[i].x++;if(papers[i].x>16)papers[i].x=2;papers[i].y=7+(uint8_t)((clock_frames/30+i)%4);move_sprite(8+i,papers[i].x*8+8,papers[i].y*8+16);
      if(papers[i].x==px&&papers[i].y==py){callout(1);hud();}}
  }
  if(!shift_seconds){for(i=0;i<3;i++)if(visitors[i].active&&visitors[i].age<12)award(-100,-2,-2,4);boss();}
}
void finish_game(void) {
  phase=6;
  if(committee)ending_id=3;
  else if(retreat)ending_id=1;
  else if(profit>=40&&trust>=65&&chaos<=60)ending_id=0;
  else if(chaos>=70||profit>=75)ending_id=2;
  else ending_id=3;
  final_score=points+(uint16_t)profit*10+(uint16_t)trust*10+(uint16_t)(100-chaos)*10;
  if(final_score>10500)final_score=10500;
  state=TALLY;tally_value=0;clear_screen();hud();text(3,5,"SHIFT COMPLETE",7);
  text(2,7,"POINTS",0);number(12,7,points,5,7);
  text(2,9,"PROFIT BONUS",0);number(13,9,(uint16_t)profit*10,4,7);
  text(2,10,"TRUST BONUS",0);number(13,10,(uint16_t)trust*10,4,7);
  text(2,11,"CALM BONUS",0);number(13,11,(uint16_t)(100-chaos)*10,4,7);
  text(2,14,"TOTAL",4);text(2,17,"A TO FINISH TALLY",0);
}
void show_ending(void) {
  const char *story;state=ENDING;clear_screen();location=ending_id==1?SCHOOL:BAR;scene();hud();
  story=ending_id==0?"The bar thrives. A masked hour, an open patio, and one short sign. Everyone grudgingly accepts it. Ruth has her stool.":ending_id==1?"Last Ditch is a clown school annex. The regulars keep their bar. Dottie credits your years of committee work toward a degree.":ending_id==2?"The bar goes viral. Nora files a human story. National visitors arrive. The community reminds them to buy a ticket.":"A subcommittee meets forever. It buys drinks and writes minutes. The first motion: keep this place alive.";
  show_dialog(ending_names[ending_id],story,FINISH,0,0,0,0,0);
}
void draw_initials(void) {
  uint8_t i;clear_screen();hud();text(3,5,"SIGN THE MINUTES",4);number(7,7,final_score,5,7);
  for(i=0;i<3;i++){tile(6+i*3,10,'A'+initials[i]-32,7);text(6+i*3,11,i==initials_pos?"^":" ",4);}
  text(2,14,"UP/DOWN LETTER",0);text(2,16,"A/RIGHT NEXT",0);text(2,17,"B/LEFT PREVIOUS",0);
}
void insert_score(void) {
  uint8_t i,j;
  for(i=0;i<5;i++)if(final_score>board[i].score){
    for(j=4;j>i;j--)board[j]=board[j-1];
    board[i].score=final_score;board[i].ending=ending_id;board[i].mask=mask_base;
    for(j=0;j<3;j++)board[i].initials[j]='A'+initials[j];
    save_board();break;
  }
  show_board(1);
}
void show_board(uint8_t from_game) {
  uint8_t i;char name[4];const char *label;state=BOARD;board_from_game=from_game;clear_screen();text(3,2,"LOCAL HIGH SCORES",4);
  text(2,4,"NAME  SCORE MASK",7);
  for(i=0;i<5;i++){memcpy(name,board[i].initials,3);name[3]=0;label=name;if(!board[i].score)label="---";number(0,6+i*2,i+1,1,4);text(2,6+i*2,label,0);number(7,6+i*2,board[i].score,5,7);text(13,6+i*2,board[i].score?mask_names[board[i].mask]:"-",0);}
  text(1,17,"A CONTINUE / B BACK",0);
}
void help(void) {
  state=HELP;clear_screen();text(3,2,"KEEP THE BAR ALIVE",7);
  text(1,4,"D-PAD: MOVE + BUMP",0);text(1,6,"A: CHOOSE / REVEAL",0);text(1,7,"B: BACK FROM QUEST",0);
  text(1,9,"GO TO ZOOM. HELP",0);text(1,10,"NEIGHBORS FOR POINTS",0);text(1,11,"VOTE. PLAY SATURDAY.",0);
  text(1,13,"SAVE ARRIVALS. DODGE",0);text(1,14,"PAPER. MASKS SHIELD",0);text(1,15,"CALL-OUTS. ANY MASK",0);text(1,16,"CAN FINISH.",0);text(1,17,"A / B TO TITLE",4);
}
void input(uint8_t keys,uint8_t pressed) {
  uint8_t i;
  if(state==DIALOG){input_dialog(pressed);return;}
  if(state==TITLE){
    if(pressed&(J_UP|J_DOWN)){selection=(selection+(pressed&J_UP?2:1))%3;sfx(0);for(i=0;i<3;i++)text(2,12+i,i==selection?">":" ",7);}
    if(pressed&(J_A|J_START|J_RIGHT)){if(selection==0)new_game();else if(selection==1)show_board(0);else help();}return;
  }
  if(state==HELP){if(pressed&(J_A|J_B|J_START))draw_title();return;}
  if(state==MASK){
    if(pressed&(J_UP|J_DOWN))mask_row=(mask_row+(pressed&J_UP?4:1))%5;
    if(pressed&(J_LEFT|J_RIGHT)){uint8_t delta=pressed&J_LEFT?3:1;if(mask_row==0)mask_base=(mask_base+delta)%4;if(mask_row==1)mask_color=(mask_color+delta)%4;if(mask_row==2)mask_pattern=(mask_pattern+delta)%4;if(mask_row==3)mask_accessory=(mask_accessory+(pressed&J_LEFT?2:1))%3;}
    if(pressed&(J_A|J_START|J_RIGHT)&&mask_row==4){stamina=max_stamina[mask_base];if(mask_base==1)trust+=10;phase=1;px=10;py=10;draw_world();return;}
    if(pressed&J_A&&mask_row<4)mask_row++;
    if(pressed)draw_mask();return;
  }
  if(state==WORLD||state==SHIFT){
    if(state==WORLD&&(pressed&J_SELECT)){location=(location+1)%3;px=10;py=10;draw_world();return;}
    if(state==SHIFT&&(pressed&J_START)){paused=!paused;if(paused){fill(0,14,20,4,0,0);text(3,15,"TAKE A BREATHER",7);text(3,17,"START TO RESUME",0);}return;}
    if(paused)return;
    if(pressed&(J_UP|J_DOWN|J_LEFT|J_RIGHT)||(!move_wait&&keys&(J_UP|J_DOWN|J_LEFT|J_RIGHT))){move(keys,state==SHIFT);move_wait=mask_base==3?7:10;}
    if(move_wait)move_wait--;return;
  }
  if(state==TALLY){if(pressed&J_A){if(tally_value<final_score)tally_value=final_score;else show_ending();}return;}
  if(state==INITIALS){
    if(pressed&(J_UP|J_DOWN))initials[initials_pos]=(initials[initials_pos]+(pressed&J_UP?1:25))%26;
    if(pressed&(J_LEFT|J_B)&&initials_pos)initials_pos--;
    if(pressed&(J_A|J_RIGHT)){if(initials_pos<2)initials_pos++;else{insert_score();return;}}
    if(pressed)draw_initials();return;
  }
  if(state==BOARD){if(pressed&(J_A|J_B|J_START)){if(board_from_game){state=CREDITS;clear_screen();text(3,3,"LAST DITCH",3);text(2,6,"EVERYONE BELONGS",7);text(2,8,"MADE W/ <3 IN ATL",0);text(2,10,"PROMPTS: ENTIRE.IO",0);text(2,13,"VERY REAL",4);text(2,14,"COMMITTEE ENERGY",4);text(2,17,"A TO TITLE",0);}else draw_title();}return;}
  if(state==CREDITS&&pressed&(J_A|J_B|J_START))draw_title();
}
void main(void) {
  uint8_t keys,pressed,i;
  DISPLAY_OFF;
  set_bkg_data(0,TILE_COUNT,tiles);set_bkg_palette(0,8,palettes);set_sprite_palette(1,1,&palettes[20]);set_sprite_palette(2,1,&palettes[12]);
  SPRITES_8x8;SHOW_BKG;SHOW_SPRITES;
  NR52_REG=0x80;NR50_REG=0x77;NR51_REG=0xFF;NR30_REG=0;
  for(i=0;i<16;i++)((volatile uint8_t *)0xFF30)[i]=i%2?0x13:0x75;
  NR30_REG=0x80;load_board();draw_title();DISPLAY_ON;
  while(1){
    vsync();total_frames++;keys=joypad();pressed=keys&~input_previous;input_previous=keys;
    input(keys,pressed);
    if(state==DIALOG&&dialog_pos<page_length()&&total_frames%2==0){dialog_pos++;reveal_character();if(dialog_pos==page_length())draw_dialog();if(dialog_pos%3==0&&sound_on){NR21_REG=0x80;NR22_REG=0x31;NR23_REG=0x80;NR24_REG=0xC7;}}
    if(state==SHIFT&&!paused)update_shift();
    if(state==TALLY){if(tally_value<final_score)tally_value=(final_score-tally_value>75)?tally_value+75:final_score;number(9,14,tally_value,5,7);}
    music();
  }
}
