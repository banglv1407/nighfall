// server/narration.js
// Cinematic, highly atmospheric narration library for Nightfall (social deduction)

const NARRATIONS = {
  night_start: [
    "🌙 Màn đêm từ từ buông xuống, nuốt chửng ngôi làng trong sương mù dày đặc. Tiếng gió rít qua những khe cửa gỗ lạnh lẽo. Lũ Sói ngoài bìa rừng bắt đầu cất tiếng hú đầu tiên. Mọi người mau khóa chặt cửa, cầu nguyện cho một đêm bình yên...",
    "🌙 Bóng tối bao trùm vạn vật. Ngọn lửa trại rực đỏ dần tàn tạ, chỉ còn lại những ánh lửa ma mị lẻ loi. Lớp sương lạnh buốt lan tỏa khắp quảng trường, mang theo điềm báo của tử thần. Hãy nhắm mắt lại... cuộc săn bắt đầu!",
    "🌙 Một vệt trăng máu rọi qua kẽ lá, báo hiệu đêm săn mồi tàn độc đã mở màn. Tiếng xích sắt kẽo kẹt bên giếng cổ vang lên u uất. Các thế lực bóng đêm đang âm thầm thức tỉnh trong phòng tối. Hãy nhắm mắt lại, và hy vọng bạn không phải là con mồi...",
    "🌙 Đêm đen tịch mịch. Tiếng cú kêu oán than vọng về từ nghĩa trang cổ kính. Từng hơi thở gấp gáp chìm vào tĩnh lặng khi người dân vội vã tắt những ngọn nến cuối cùng. Các bóng đen đã bắt đầu bước ra. Chúc may mắn sống sót qua đêm nay!"
  ],
  
  no_deaths: [
    "☀️ Ánh ban mai ấm áp lướt nhẹ qua những mái ngói đỏ rực, xua tan đi làn sương lạnh lẽo của bóng đêm. Thật kỳ diệu, ngọn lửa trại vẫn ấm áp và tiếng chim hót vang lên yên bình. Một đêm trôi qua tĩnh lặng... Không một ai ngã xuống!",
    "☀️ Mặt trời lười biếng nhô lên sau rặng núi, phủ một màu vàng dịu dàng lên con đường đá cổ. Người dân rụt rè mở cánh cửa gỗ, nhìn nhau thở phào nhẹ nhõm. Đêm qua tử thần đã gõ cửa hụt... Toàn bộ dân làng đều bình an vô sự!",
    "☀️ Làn khói bếp thanh bình lại bắt đầu bay lên từ mái nhà tranh. Đêm kinh hoàng trôi qua mà không có một giọt máu nào đổ xuống. Thần hộ mệnh đã mỉm cười với ngôi làng trong bóng tối. Hôm nay, tất cả chúng ta đều chào ngày mới!",
    "☀️ Khi những tia nắng đầu tiên sưởi ấm quảng trường làng, nỗi sợ hãi tạm thời lắng xuống. Cửa giếng cổ phản chiếu bầu trời xanh ngắt thanh bình. Thần chết đã trắng tay đêm nay... Không có casualties nào được tìm thấy!"
  ],

  deaths: [
    "☀️ Tiếng chuông nhà thờ vang lên hồi chuông báo tử đầy ai oán dưới ánh bình minh lạnh lẽo. Trên bãi cỏ ẩm ướt cạnh giếng cổ, một bóng người lạnh ngắt nằm bất động từ lúc nào. Sự yên bình đã vỡ nát... Người ngã xuống đêm qua: {names}.",
    "☀️ Làn sương sớm tan đi, để lộ một cánh cửa nhà bị phá toang hoang lạnh lẽo. Bên trong, một chiếc giường trống không lạnh ngắt cùng vết máu kéo dài ra thảm cỏ. Một linh hồn tội nghiệp đã bị bóng tối bắt đi: {names}.",
    "☀️ Một buổi sáng ngột ngạt bao trùm cả ngôi làng. Nỗi kinh hoàng hiện rõ trên khuôn mặt mỗi người khi họ tập trung quanh quảng trường, nhìn vào khoảng đất trống bên gốc thông cổ thụ nơi xác một người dân nằm đó: {names}.",
    "☀️ Trăng lặn, ngày lên, nhưng bóng tối vẫn kịp cướp đi hơi ấm của ngôi làng trước khi tia nắng đầu tiên chạm xuống. Tiếng kêu gào ai oán xé rách bầu không khí yên bình sớm mai. Cầu nguyện cho linh hồn của: {names}."
  ],

  voting_start: [
    "🗳️ Mặt trời đứng bóng rọi thẳng xuống quảng trường làng. Mọi người tập trung thành vòng tròn quanh đống lửa. Không còn nụ cười, chỉ còn những ánh mắt sắc lạnh, nghi ngờ đổ dồn vào nhau. Đã đến lúc đưa kẻ bị tình nghi lên đoạn đầu đài!",
    "🗳️ Căng thẳng dâng cao tột độ. Dân làng đứng chen chúc, hơi thở nặng nề dưới sức nóng của buổi trưa. Những lời thì thầm to nhỏ đầy hoài nghi bắt đầu hướng vào nhau. Ai đang giấu móng vuốt dưới lớp áo dân? Hãy bỏ phiếu ngay!",
    "🗳️ Sự thật và dối trá đan xen trong từng hơi thở. Ngón tay buộc phải chỉ hướng, sự im lặng không còn là lá chắn an toàn. Hãy sáng suốt cầm lá phiếu của bạn để cứu ngôi làng hoặc đẩy một kẻ vô tội vào cõi chết!",
    "🗳️ Giờ phán xét đã điểm! Công lý của dân làng sẽ được thực thi bằng những phiếu biểu quyết trực tiếp. Kẻ mang mặt nạ dối trá sẽ phải bước ra ánh sáng. Hãy lựa chọn người nghi vấn nhất!"
  ],

  defense_start: [
    "⚖️ Đứng trước giá treo cổ lạnh lẽo dưới ánh nắng chiều tà, bị cáo {name} bước lên bục phán xét trong sự im lặng đáng sợ của đám đông. Từng giây trôi qua như ngàn cân treo sợi tóc. Bạn có 30 giây để biện hộ cho mạng sống của mình!",
    "⚖️ Mọi ánh mắt phán xét ghê người đổ dồn về phía {name}. Sợi dây thừng treo cổ đang đung đưa nhẹ theo gió như chờ đợi. Đây là ranh giới cuối cùng giữa sự sống và cái chết. Bị cáo, hãy bắt đầu lời biện hộ cuối cùng!",
    "⚖️ Bầu không khí ngưng đọng tột cùng. {name} đứng run rẩy trước hội đồng làng, đối mặt với những ngón tay đang chỉ trích. Hãy cất tiếng nói chứng minh sự vô tội của mình trước khi quá muộn!",
    "⚖️ Thời gian đứng yên. Chỉ có tiếng nhịp tim đập dồn dập của bị cáo {name} vang lên giữa quảng trường im phăng phắc. Lời bào chữa nào sẽ thuyết phục được lòng tin của dân làng? Hãy bắt đầu biện hộ!"
  ],

  execution: [
    "⚖️ Tiếng trống đập dồn dập rồi đột ngột tắt lịm. Sợi dây thừng siết chặt xé toạc bầu không khí yên lặng. Một tiếng động khô khốc vang lên... {name} đã trút hơi thở cuối cùng trên giá treo cổ. Linh hồn lìa xác bay vào khoảng hư vô cô tịch.",
    "⚖️ Công lý hay sai lầm tàn nhẫn đã được thực thi? Sợi dây treo đung đưa xác thịt lạnh ngắt của {name} dưới ánh hoàng hôn nhuốm đỏ máu. Ngôi làng chìm vào tĩnh lặng tang tóc khi chứng kiến cái chết của một người chơi...",
    "⚖️ Lưỡi hái của tử thần đã hạ xuống quảng trường làng. Đám đông im lặng quay đầu đi khi {name} gục xuống vĩnh viễn trên bục treo cổ. Bóng tối đang cười nhạo sự phán xét đau đớn này của dân làng.",
    "⚖️ Phán quyết cuối cùng đã hoàn tất! Hơi thở của {name} lịm dần khi ngọn lửa trại bùng lên một tia lửa cuối cùng rồi lịm tắt. Một sinh mạng nữa đã bị dập tắt dưới sự phán xét lạnh lùng của đám đông."
  ],

  spared: [
    "⚖️ Sợi dây thừng được cắt đứt! {name} ngã khụy xuống thảm cỏ, thở dốc trong sự cứu rỗi nghẹt thở. Đám đông xầm xì buông tay, tha bổng cho nạn nhân lần này. Nhưng nghi ngờ vẫn còn đó, âm ỉ cháy...",
    "⚖️ Phép màu đã xảy ra vào phút chót! Số đông dân làng quyết định hạ ngón tay xuống, tha mạng cho {name}. Trở về từ cõi chết, bị cáo run rẩy hòa vào đám đông, biết rằng bóng tối vẫn đang theo dõi từng bước chân mình.",
    "⚖️ Tiếng reo hò cứu rỗi khẽ vang lên. {name} được tháo bỏ gông xiềng, bước xuống bục treo cổ trong sự tha thứ ngập tràn nghi vấn của làng. Mạng sống tạm thời được giữ lại, nhưng đêm nay ai sẽ là người tiếp theo gánh chịu nghi kỵ?",
    "⚖️ Mọi người quyết định cho {name} một cơ hội sống thứ hai. Mối dây oan nghiệt tạm thời cởi bỏ. Người dân giải tán trong sự hoang mang tột độ, quay về khóa chặt cửa khi hoàng hôn bắt đầu chuyển sang màu xám xịt."
  ]
};

export function getRandomNarration(type, data = {}) {
  const variations = NARRATIONS[type];
  if (!variations) return "";
  const randomIdx = Math.floor(Math.random() * variations.length);
  let text = variations[randomIdx];

  // Insert template data if needed (e.g. {names}, {name})
  if (data.names) {
    text = text.replace("{names}", data.names);
  }
  if (data.name) {
    text = text.replace("{name}", data.name);
  }
  return text;
}
