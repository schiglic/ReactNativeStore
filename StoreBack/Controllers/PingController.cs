using Microsoft.AspNetCore.Mvc;

namespace StoreBack.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PingController : ControllerBase
    {
        [HttpGet]
        public IActionResult Ping()
        {
            return Ok(new { message = "Server is up and running" });
        }
    }
}