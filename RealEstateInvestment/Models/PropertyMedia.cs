namespace RealEstateInvestment.Models
{
    public enum MediaType
    {
        Image = 1,
        Video = 2
    }

    public class PropertyMedia
    {
        public Guid Id { get; set; }
        public Guid PropertyId { get; set; }
        public Property Property { get; set; } = null!;

        public MediaType Type { get; set; }

        // Для image превью может добавима может нет
        public string? Base64Data { get; set; }
         
        public string? Url { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string? FileName { get; set; }
        public string? ContentType { get; set; }
        public long Size { get; set; }
    }

}
