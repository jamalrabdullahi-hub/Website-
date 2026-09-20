# -*- coding: utf-8 -*-
"""Add the live 1688 products (pulled through the Apify actor zen-studio/1688-wholesale-scraper) to data/catalog.csv.

Every row below is a real 1688 offer: the supplier's own asking price in CNY, their minimum order, the published unit
weight where they give one, the company name and the product URL. Nothing is invented. Rows land as cost_verified=check,
like every other harvested row — a person confirms the price with the supplier before it is trusted.

1688 titles are Chinese, and machine-translating a product name someone is about to spend money on is a bad idea, so the
listing name is built from a plain English category label plus the specs the title actually states (2.3L, 20000mAh,
6.2kW). The supplier's original Chinese title is kept in the specs as provenance.

    python tools/add-1688.py && python tools/import-catalog.py
"""
import csv, io, os, re, datetime

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TODAY = datetime.date.today().isoformat()
IMG = "https://cbu01.alicdn.com/img/ibank/"

# cat, English label, Somali blurb, default kg
GROUPS = {
    "kettle":    ("HOM", "Electric kettle",  u"Kildhi koronto — shaah iyo biyo kulul dhakhso.", 1.2),
    "inverter":  ("SOL", "Solar inverter",   u"Inverter solar — koronto guriga iyo dukaanka, xitaa marka korontadu go'do.", 8),
    "fan":       ("APL", "Rechargeable fan", u"Marawaxad dallacaad leh — way shaqaysaa marka korontadu go'do.", 0.8),
    "generator": ("BLD", "Petrol generator", u"Matoor koronto baansiin ah — guri, dukaan iyo shaqo.", 45),
    "chair":     ("FRN", "Office chair",     u"Kursi xafiis oo raaxo leh, sare iyo hoos loo dhigi karo.", 14),
    "powerbank": ("ELC", "Power bank",       u"Power bank — taleefanka ku dallac meel kasta.", 0.4),
}

# (group, offerId, title_zh, price_cny, moq, kg_or_None, supplier, image_tail)
ROWS = [
 ("kettle","1001474726000",u"高硼硅养生壶全玻璃大容量316水龙头花茶壶烧水壶分体式电热水壶",59,1,3,u"中山市映之美电器有限公司","O1CN01UjESQw20X1LRPD54L_!!2316516858-0-cib.jpg"),
 ("kettle","673288907462",u"志高电热水壶家用烧水壶保温自动断电不锈钢大容量热水壶批发",28.9,1,None,u"宁波赵记电器有限公司","O1CN01aLvPeA28WZsZTjRj6_!!2867367940-0-cib.jpg"),
 ("kettle","1050437587179",u"万利达热水壶自动保温大容量电热水壶不锈钢2.3L电烧水壶家用宿舍",14.55,1,None,u"义乌市尘筱电器有限公司","O1CN017aL2Np1t0mAIdkDqR_!!2222124235840-0-cib.jpg"),
 ("kettle","577323329907",u"美能迪桶装水可加热烧水自动上水式电热烧水壶家用不锈钢煮水壶",85,1,1.5,u"中山市美能迪网络科技有限公司","O1CN01S6qkOg1UCo1t1BX3t_!!3702972482-0-cib.jpg"),
 ("kettle","1075333692725",u"XH电热水壶保温防烫大容量快烧水壶宿舍自动断电热水壶",48,1,None,u"义乌市聚屿网络科技有限公司","O1CN01aQl9f4bbvDG1chua_!!2222843021986-0-cib.jpg"),
 ("kettle","1050298156500",u"万利达养生壶家用多功能煮茶壶办公室自动保温大容量煮花茶烧水壶",26,1,None,u"东莞市冠泽科技有限公司","O1CN01qI1Kiq2HuhImGEk2j_!!2213945849211-0-cib.jpg"),
 ("kettle","916581922325",u"折叠烧水壶家用便携式小型可折叠水壶硅胶迷你壶",14,2,None,u"中山市随盛电器有限公司","O1CN01bSYmZr26bUupjhXqD_!!2219732927680-0-cib.jpg"),
 ("kettle","1063012019039",u"奥克斯养生壶炖煮一体电热水壶家用多功能煮茶恒温壶办公室烧水壶",41,1,None,u"中山市加宝电器有限公司","O1CN01FDbFqr1Ck5tIOuWPQ_!!3301980118-0-cib.jpg"),
 ("kettle","769499103463",u"志高0.8L酒店办公室烧水壶迷你电热水壶宿舍开水壶",25,1,None,u"廉江市昊帝商贸有限公司","O1CN01bqy68X1ik9Zb5wEfQ_!!2217508784450-0-cib.jpg"),
 ("kettle","646763552318",u"善优佳养生壶煎药壶防干烧连体全自动电热烧水壶耐高温中药养生壶",30,1,None,u"潮州市潮安区东凤镇烨宝不锈钢制品厂","O1CN01tyBT0i1z8S34S6GpM_!!2211578036669-0-cib.jpg"),
 ("kettle","951066124948",u"现货欧规意大利SMEG复古电热水壶泡茶7档温度家用送礼",400,1,None,u"义乌市娇挚电子商务商行","O1CN01nHI2o927LkrMW39e4_!!2220202697781-0-cib.jpg"),
 ("kettle","630450032643",u"正品志高恒温电热水壶家用双层防烫烧水壶自动断电电水壶",24,1,1,u"深圳市龙华区欧邦电器商行","O1CN01F0oFhr21SGTlaVDJS_!!2200735446983-0-cib.jpg"),
 ("kettle","1050626757124",u"3L烧水壶不锈钢电热水壶酒店电水壶自动保温水壶家用",20.9,1,None,u"廉江不忘初心电器有限公司","O1CN01jrTy4A1vAVoaCtIvb_!!2606086132-0-cib.jpg"),
 ("kettle","1040328213707",u"荣事达304不锈电热水壶家用烧水壶全自动保温一体开水壶小型便携",55,1,None,u"深圳市波波厨实业有限公司","O1CN0167VB3g1MNmjYRP3Ao_!!2214786931423-0-cib.jpg"),
 ("kettle","1072701338933",u"万利达双层耐用防烫电热水壶大容量自动断电不锈钢烧水壶",15.5,1,None,u"义乌市顺祯电器厂","O1CN01ed6h7QzER3F23e9y_!!2222415622867-0-cib.jpg"),
 ("kettle","720100536175",u"winning star 跨境家用小家电烧水壶热水壶英规欧规轻便快捷现货",51,32,1.33,u"义乌市乌莱恩贸易有限公司","O1CN01SOv5Ay1CNBywDnhDF_!!2214721800068-0-cib.jpg"),
 ("kettle","1011539287010",u"跨境不锈钢电热水壶小容量家用电热水壶自动保温电热烧水壶CB、CE",59.51,1,1,u"中山市阿帕其电器有限公司","O1CN01zzqnLx1I8QzYXufan_!!2009730848-0-cib.jpg"),
 ("kettle","1066013766721",u"万利达电热水壶家用烧水壶大容量水壶自动断电开水壶家用水壶",15,2,None,u"义乌市黄埠电器有限公司","O1CN01zmNVYW2AqqfzlNJLM_!!2222752668255-0-cib.jpg"),
 ("kettle","1009705341057",u"不锈钢电热壶电烧水壶自动断电保温耐煮水泡茶热水壶不锈钢",28,1,0.3,u"潮州市潮安区彩塘镇美之利五金厂","O1CN01Y78osr2IWi9PicApn_!!2221404429294-0-cib.jpg"),

 ("inverter","1052821001320",u"光伏太阳能逆变器逆控一体机内置mppt太阳能控制器混合控制逆变器",830,10,12,u"佛山市晟阳太阳能科技有限公司","O1CN01zbbKqe29gwU4ieQXZ_!!2212559748098-0-cib.jpg"),
 ("inverter","782743814562",u"6.2KW离并网混合光伏逆变器MPPT120A双AC输出+双通讯逆控一体机",1500,1,10.3,u"广东三瑞电源有限公司","O1CN01tiyHcz1bTw6feGZnh_!!2217492633467-0-cib.jpg"),
 ("inverter","980307860132",u"纯正弦波逆变器12V24V48V72V96车载家用源头厂家光伏太阳能大功率",568,1,2.5,u"化州市冼科智电子科技有限公司","O1CN01E11pxR1VFNyLH4vOx_!!2220822142623-0-cib.jpg"),
 ("inverter","682499040989",u"1-5kw12V-96v转220V110V太阳能车载家用离网光伏纯正弦波逆变器",178,1,None,u"化州市三合电能科技有限公司","O1CN01ad4iv01zyfI6cdbFA_!!2207273826783-0-cib.jpg"),
 ("inverter","708053612205",u"泰琪丰纯正弦波离网工频太阳能逆变器 光伏储能逆控一体机家用",560,5,None,u"广东泰琪丰电子有限公司","O1CN01pVcyNKYwxPB1chua_!!2209968541960-0-cib.jpg"),
 ("inverter","1065075817134",u"泰琪丰11KW混网逆变器太阳能光伏高频离网户用混合储能逆控一体机",100,5,None,u"广东泰琪丰电子有限公司","O1CN01yjqo0T1QLjRPwNeci_!!2209968541960-0-cib.jpg"),
 ("inverter","1069706984960",u"12kw高频混合太阳能逆变器防逆流CT光伏太阳能发电储能逆控一体机",1125,5,None,u"广东泰琪丰电子有限公司","O1CN01B8yH5zMqRqD1chua_!!2209968541960-0-cib.jpg"),
 ("inverter","988696190780",u"跨境纯正弦波逆变器太阳能光伏大功率家用车载12V-96V转110V-220V",558,1,2.1,u"化州市冼科智电子科技有限公司","O1CN01okqCAV1VFNypv8llM_!!2220822142623-0-cib.jpg"),
 ("inverter","691094745026",u"6200W光伏储能逆变器3KW MPPT高频逆控一体机混合太阳能逆变器48V",115,3,None,u"广州德姆达光伏科技有限公司","O1CN01Kjnfer1oq0FgawDDh_!!2214850845275-0-cib.jpg"),
 ("inverter","822272082671",u"sako逆变器4500W6500W太阳能混合光伏逆变器储能逆控一体机高效",2280,1,12,u"广东三科新能科技有限公司","O1CN01LfuKlI1zOUCeNwqRd_!!2215284106704-0-cib.jpg"),
 ("inverter","624741594455",u"旭缘车载逆变器12v24v转110v太阳能家用电源转换器6000w数显美规",154,2,None,u"广州旭缘新能源有限公司","O1CN01vtHtnZ1pjsXuFVCUW_!!2563505397-0-cib.jpg"),
 ("inverter","860333432899",u"智弦3000W纯正弦波逆变器12V24V48V转220V家用车载 太阳能转换",270,1,None,u"化州市正弦电子科技有限公司","O1CN01kZe4UG1g9qt1YENH9_!!2750644100-0-cib.jpg"),

 ("fan","986529928489",u"跨境新款X8暴力风扇高速风扇车载吹尘便捷式涡轮无线吹风机迷你",24,1,None,u"深圳市铭煜东升科技有限公司","O1CN01rpAcA81RdQJaObmqp_!!2220995752134-0-cib.jpg"),
 ("fan","676791062945",u"usb充电款小风扇挂壁小型迷你手持电风扇家用宿舍桌面风扇跨境",13,1,0.49,u"揭阳市盛仕达科技有限公司","O1CN01bpj5K81dNBN5dAvxP_!!3487363723-0-cib.jpg"),
 ("fan","1039162242894",u"新款户外风扇露营风扇野营帐篷电风扇便携式充电款摇头风扇可照明",21,1,None,u"义乌市卓驰户外用品有限公司","O1CN01ibAvSb2HyosWNTuyo_!!2208610119220-0-cib.jpg"),
 ("fan","784671047598",u"挂脖风扇跨境usb充电户外大风力制冷挂脖小风扇小型",7.8,5,None,u"深圳市鑫创纪元电子有限公司","O1CN01JuKgdX1PZBOkyOu5R_!!1012691854-0-cib.jpg"),
 ("fan","666483122549",u"跨境户外风扇野营帐篷usb风扇便携式大风力充电露营风扇照明挂钩",14,1,None,u"深圳市东方浩电子科技有限公司","O1CN01AEUHNO1J2lhrS41NM_!!2830130971-0-cib.jpg"),
 ("fan","892195653235",u"手持小风扇充电便携迷你风扇学生奖品批发",2.8,1,None,u"广州飞澄玩具商行","O1CN01KRTuhw1SAOlAmrXrU_!!2219359392206-0-cib.jpg"),
 ("fan","1050031636786",u"x688高速迷你手持风扇USB充电持久续航涡轮便携式户外小风扇",6.3,2,None,u"深圳市星锋益科技有限公司","O1CN01MeAJwc2D2PtegWrOL_!!2222172958551-0-cib.jpg"),
 ("fan","941947577220",u"挂腰风扇随身便携式夹腰间双风道高速USB充电大风力户外制冷风扇",19,1,None,u"深圳市东方浩电子科技有限公司","O1CN01v8Dx5h1J2lf3VWKfT_!!2830130971-0-cib.jpg"),
 ("fan","900174134745",u"卡西道夫小风扇办公桌面电风扇USB6寸摇头可充电台式床头扇长续航",10,1,None,u"揭阳市德阁科技有限公司","O1CN01fePHoc1lMHk36Fnzt_!!2216787634804-0-cib.jpg"),
 ("fan","860959570175",u"爱登厨房空调新款制冷挂壁风扇大风力充电风扇家用台立遥控",355,1,None,u"杭州湘庭国际贸易有限公司","O1CN011Jwh052BL4gIEaeIG_!!2211390908321-0-cib.jpg"),
 ("fan","1009622872564",u"跨境户外露营风扇灯大风力长续航充电式夜钓照明悬挂营地便携风扇",91.05,1,None,u"义乌市锦鹏电器有限公司","O1CN016EYGT21u1WP5pQ1a1_!!2221343355977-0-cib.jpg"),
 ("fan","937980280456",u"外贸充电多功能风扇静音桌面办公宿舍户外电风扇带灯太阳能帐篷",73.5,1,1.02,u"余姚市轩珂电子有限公司","O1CN01vLfs2X1lbrEHqQtlX_!!2219627034838-0-cib.jpg"),
 ("fan","1031614498047",u"跨境带遥控可充电小吊扇学生宿舍床上USB风扇户外露营小风扇",18.5,1,None,u"中山市帝曼森灯饰有限公司","O1CN01Hhdlsl2AjWJWhkKel_!!2210226248239-0-cib.jpg"),
 ("fan","724491341873",u"涡轮扇无刷10万转电动风扇便携车载吸尘器可充电无线吹风机",95,5,None,u"宁波望山一龙机电有限公司","O1CN01U6dhHs1QXB2XPrl6G_!!2207981361985-0-cib.jpg"),
 ("fan","737879895930",u"桌面风扇摇头小风扇学生宿舍台式usb充电便捷迷你电扇轻音长续航",43,1,0.34,u"东莞市兴信洋电子科技有限公司","O1CN018DalfE29bRikE5kGd_!!3894478086-0-cib.jpg"),
 ("fan","684839850500",u"小风扇迷你广告显字小风扇迷你充电风扇迷你电风扇显字风扇led",3.7,100,0.07,u"深圳市点亮晓叶科技有限公司","O1CN01iPUDHw1pYt4AQXLSn_!!3440615373-0-cib.jpg"),

 ("generator","973445655859",u"便携式3KW 5KW小型汽油/LPG双燃料变频发电机230V户外静音发电机",1300,1,None,u"重庆凯纳机电有限公司","O1CN01KoXghH1erFFc4jUqu_!!3447703924-0-cib.jpg"),
 ("generator","805070187072",u"Bison2kw小型发电机220v变频汽油发电机低耗能家用房车户外低噪音",1575,3,None,u"浙江柏森动力机械有限公司","O1CN01yrpUd71ZivrPSdMHh_!!2452883229-0-cib.jpg"),
 ("generator","857689762630",u"发电机汽油小型便携家用静音220V380v工地户外3/5/10千瓦工厂直发",350,1,None,u"福安市泰宇电机有限公司","O1CN01JE1jTz2AQHVAX3A98_!!3985108197-0-cib.jpg"),
 ("generator","866595165364",u"日本HONDA本田汽油发电机220V小型3KW家用2/4/5/9/11KVA静音/开架",18600,1,None,u"福州宁心机电设备有限公司","O1CN015uTLXv20fGMoRaFKU_!!2218962596876-0-cib.jpg"),
 ("generator","968328589768",u"跨境台湾香港海外家用小型汽油发电机110V/220V频率60HZ静音变频",2850,1,None,u"福安市闽跃电机有限公司","O1CN01g37AaZ2CJzQJiVYr7_!!2213027198454-0-cib.jpg"),
 ("generator","945337208198",u"新款650W汽油发电机220v欧规110V美规家用户外小型750W1000W跨境",380,1,None,u"黄山市兴创电器有限公司","O1CN010dxuxa1rqruQ8S5Sr_!!961285683-0-cib.jpg"),
 ("generator","1080335410203",u"LB-950B 家用 二冲程 汽油发电机",380,10,None,u"台州市路桥豪捷进出口有限公司","O1CN01YkYWFSK7K8K1pIOu_!!2219722237801-0-cib.jpg"),
 ("generator","740195526189",u"Bison小型汽油发电机组3kw双燃料天然气220v单相家用便携式发电机",695,5,None,u"浙江柏森动力机械有限公司","O1CN01xWeiRG1ZivrCrtKch_!!2452883229-0-cib.jpg"),
 ("generator","896131184095",u"汽油发电机220V家用小型5/6/8/10/12千瓦单相三相380V户外商用",1260,1,None,u"福安市腾隆科技有限公司","O1CN01OBcQJ31m8piohGAer_!!2210037654910-0-cib.jpg"),
 ("generator","1008417513114",u"汽油3/5/8kw/10千瓦220v380V单三相50HZ便捷式小型应急家用发电机",1106,1,None,u"重庆鑫巴特机械有限公司","O1CN01UY8S27RUC9E1chua_!!2212566093417-0-cib.jpg"),
 ("generator","733572260187",u"Bison小型家用2kw变频发电机静音汽油双燃料天然气便携发电机220v",1335,5,20,u"浙江柏森动力机械有限公司","O1CN019OchXQ1Zivr3SbDGt_!!2452883229-0-cib.jpg"),
 ("generator","981370329117",u"小型汽油发电机3KW5KW8KW10KW 移动应急项目家用发电机组230/380V",920,1,None,u"重庆伟越鑫机电有限公司","O1CN01FZjuG41NaRFo3aFih_!!2217375421586-0-cib.jpg"),
 ("generator","1007042345950",u"10千瓦智能变频汽油发电机220v永磁户外工地家用小型移动大功率",5500,1,23.5,u"重庆釜望通用机械设备有限公司","O1CN01LFlDDt1T6Z8RwEx7v_!!3372812333-0-cib.jpg"),
 ("generator","850241354009",u"发电机汽油小型便携式户外交流单相三相露营户外工地静音家用工厂",350,1,None,u"福安市泰宇电机有限公司","O1CN01FBP5sS2AQHNcfb3am_!!3985108197-0-cib.jpg"),
 ("generator","984867061872",u"开架变频汽油发电机可焊接两用一体机220v小型户外便携户外工地",1837,1,None,u"重庆凯纳机电有限公司","O1CN01f2zJnI2m57F1chua_!!3447703924-0-cib.jpg"),
 ("generator","630779418798",u"可加EPA220V小型发电机微型汽油发电机迷你手提便携式家用",349,5,None,u"浙江柏森动力机械有限公司","O1CN0165fijf1ZiviBUZySD_!!2452883229-0-cib.jpg"),

 ("chair","915435648534",u"电竞椅舒服久坐人体工学游戏椅可躺按摩旋转椅子学生宿舍电脑椅",139,1,15,u"安吉直客家具有限公司","O1CN01FiJqvz1D4hdWWdj8N_!!2207829200163-0-cib.jpg"),
 ("chair","897452225764",u"傲风C3Pro新版 电竞椅 人体工学椅 游戏椅办公椅 AF306",1399,1,None,u"宁波傲风科技有限公司","O1CN01UGtPOh2BlBHM9SQmE_!!2208351878378-0-cib.jpg"),
 ("chair","676087028112",u"现代简约电脑椅家用椅子办公椅靠背升降转椅舒适久坐老板椅职员椅",499,1,None,u"安吉翌家家具有限责任公司","O1CN01GxTE6M2LQhS5n5Tdu_!!2561409687-0-cib.jpg"),
 ("chair","744462878913",u"电竞椅家用网吧电脑转椅弹力办公主播旋转椅子跨境人体工学久坐椅",119,1,None,u"安吉优格家具股份有限公司","O1CN01BLEyMs1ncR1h9EU9O_!!3217735110-0-cib.jpg"),
 ("chair","826807874328",u"黑白调X7智能人体工学椅电动按摩电脑椅久坐椅子电竞椅座椅办公椅",4299,1,None,u"宁波黑白调科技有限公司","O1CN01uiVefT1djd4WePGpK_!!2214472143772-0-cib.jpg"),
 ("chair","898167037363",u"人体工学椅久坐舒适办公椅靠背椅家用转椅子书房电脑椅宿舍电竞椅",169,1,None,u"浙江安吉泰畅智能家居科技有限公司","O1CN01cT57uhhR4oC2vH2e_!!2215525847931-0-cib.jpg"),
 ("chair","814231053886",u"电脑椅家用办公椅家庭靠背舒适座椅镂空椅学习长坐人体工学椅",334,1,None,u"安吉仁泰家居有限公司","O1CN01pXNDLk1Kdh6AhmLad_!!2214087321187-0-cib.jpg"),
 ("chair","913011441439",u"傲风机械大师M603 电竞椅人体工学椅 电脑椅 办公椅学习椅 AFM603",1899,1,None,u"宁波傲风科技有限公司","O1CN01PHTw6F2BlBHuCSqG7_!!2208351878378-0-cib.jpg"),
 ("chair","997834482076",u"电脑椅人体工学椅升降扶手坐垫可躺椅子办公椅主播电竞椅久坐椅子",185,1,None,u"安吉爱可家具厂","O1CN01IRJbPQ1GUIedYze62_!!2218519550625-0-cib.jpg"),
 ("chair","1005575974114",u"午睡两用人体工学椅家用电脑椅可升降电脑椅学生电竞椅职员办公椅",101,1,3,u"霸州市信安镇嘉旭钢木家具厂","O1CN01oV0VAc1Qk0OTCNBmk_!!2219525352013-0-cib.jpg"),
 ("chair","684809362993",u"椅子电竞椅游戏椅人体工学椅办公座椅办公椅子批发家用定型棉7042",178,1,None,u"安吉优格家具股份有限公司","O1CN01ZaT17b1ncQpNlAhGa_!!3217735110-0-cib.jpg"),
 ("chair","806660609602",u"电竞椅电脑椅gamingchair人体工学宿舍升降现代简约办公电竞椅",163,1,None,u"湖州安吉乐鑫家具有限公司","O1CN01qadngk1FXDS6Ss4Tx_!!2217932080496-0-cib.jpg"),
 ("chair","1061176733290",u"多色网纱办公椅家用可调节电脑椅人体工学转椅办公职员培训座椅",74,100,None,u"霸州市森琪家具有限公司","O1CN011FyzEc1iNiEa21uWW_!!2208783824401-0-cib.jpg"),
 ("chair","1018866000660",u"青少年学习椅初高中学生专用电脑椅子办公椅人体工学电脑舒服久坐",319,1,None,u"安吉天荒坪美旭家具厂","O1CN01b3HgXa2Hcppzs9bB8_!!2212643049172-0-cib.jpg"),
 ("chair","587462490504",u"gaming chair电竞椅电脑椅家用办公椅游戏座椅网吧竞技升降椅子",101,1,None,u"安吉优格家具股份有限公司","O1CN01pwqLF51ncR0OmZCmw_!!3217735110-0-cib.jpg"),
 ("chair","732824966920",u"电脑椅家用办公椅升降转椅舒适久坐家用学生宿舍人体工学靠背椅子",159,1,None,u"安吉仁泰家居有限公司","O1CN01lNR8AI1KdguFx2HrU_!!2214087321187-0-cib.jpg"),

 ("powerbank","1080014385497",u"3C认证充电宝超级快充自带线20000毫安便携式移动电源KC跨境",29,1,None,u"深圳市够顶真科技有限公司",""),
 ("powerbank","847492739608",u"Magsafe磁吸无线充电宝背夹电池5000毫安小巧便携移动电源",9,1,0.4,u"深圳市捷品世纪电子有限公司",""),
 ("powerbank","1050699648627",u"跨境外贸户外太阳能充电宝20000mah防水指南针电源",16.5,1,0.5,u"东莞市特念科技有限公司",""),
 ("powerbank","1058492609998",u"灯塔自带线22.5W超级快充充电宝大容量80000毫安露营移动电源",42,10,None,u"广州市创盛远跨境电商有限公司",""),
 ("powerbank","1061743762103",u"跨境自带线AC插头充电宝超级快充移动电源10000毫安 礼品定制",57,10,None,u"深圳市炫翰隆科技有限公司",""),
 ("powerbank","981845428349",u"3C认证DC接口12V/7.4V恒温箱灯条空调服充电宝20000毫安移动电源",60,1,None,u"东莞市东城淘小电子厂",""),
 ("powerbank","828310718869",u"磁吸充电宝自带线无线充magsafe迷你共享快充移动电源 power bank",41,5,None,u"惠州市畅维科技有限公司",""),
 ("powerbank","868376563852",u"22.5W超级快充磁吸15W无线充电宝20000毫安AC插头自带线移动电源",73,1,None,u"深圳鸿世通电子有限公司",""),
 ("powerbank","1079676762514",u"MagSafe无线3c磁吸充电宝5000毫安小巧便捷礼品定制移动电源",19,1,None,u"深圳市相辉讯充实业有限公司",""),
 ("powerbank","1081366322128",u"新款充电宝3c认证大容量2万毫安自带线移动电源企业定制礼盒",41,8,None,u"深圳市好吉力科技有限公司",""),
 ("powerbank","1032280969142",u"MagSafe无线3C迷你磁吸充电宝快充小巧便捷礼品定制移动电源",32,1,None,u"深圳市相辉讯充实业有限公司",""),
 ("powerbank","1078535791187",u"跨境新款太阳能快充充电宝200000毫安超大容量移动电源power bank",52.68,1,None,u"深圳市旗盛数码科技有限公司",""),
 ("powerbank","911366945826",u"跨境Magsafe磁吸无线充电宝10000毫安自带线超级快充支架移动电源",32.88,10,None,u"深圳市鸿泰世纪科技有限公司",""),
 ("powerbank","802822303436",u"3C大容量自带线充电宝30000毫安快充实标礼品移动电源定制",55,3,None,u"东莞市卡俪欧电子科技有限公司",""),
 ("powerbank","1027714914997",u"跨境户外太阳能充电宝20000mAh大容量LED照明防水移动电源",21,1,0.5,u"东莞市赵电科技有限公司",""),
]

SPEC = re.compile(r"(\d+(?:\.\d+)?)\s*(kw|KW|Kw|kW|W|w|V|v|L|ml|mAh|mah|毫安|千瓦|升)")
UNIT = {u"毫安": "mAh", u"千瓦": "kW", u"升": "L", "mah": "mAh", "w": "W", "v": "V", "kw": "kW", "KW": "kW", "Kw": "kW"}

def specs_from(title):
    """Numbers the supplier's own title states — language-neutral and checkable against the listing."""
    out, seen = [], set()
    for val, unit in SPEC.findall(title):
        u = UNIT.get(unit, unit)
        tok = val + u
        if tok in seen:
            continue
        seen.add(tok)
        out.append(tok)
        if len(out) == 2:
            break
    return out

rows, counter = [], {}
for group, offer, title, price, moq, kg, supplier, img in ROWS:
    cat, label, blurb, kg_default = GROUPS[group]
    counter[cat] = counter.get(cat, 0) + 1
    tokens = specs_from(title)
    model = (label + " " + " ".join(tokens)).strip()
    # several offers of the same thing state no specs; keep names distinct with the offer's own id
    if model in [r["model"] for r in rows]:
        model = model + " #" + offer[-4:]
    weight = kg if (kg and 0.05 <= kg <= 500) else kg_default
    rows.append({
        "sku": "GRS-%s-%05d" % (cat, 30000 + counter[cat]),
        "cat": cat, "brand": "Generic", "model": model, "model_no": offer,
        "variant": "Standard", "color": u"—", "color_hex": "",
        "cost_cny": price, "kg": weight, "moq": moq,
        "source_platform": "1688", "source_url": "https://detail.1688.com/offer/%s.html" % offer,
        "supplier": supplier, "cost_verified": "check", "blurb_so": blurb,
        "image": (IMG + img) if img else "",
        "price_usd": "", "moq_unit": "piece",
        "specs": u"Magaca asalka ah: " + title,
        "captured": TODAY, "search": group,
    })

path = os.path.join(ROOT, "data", "catalog.csv")
with io.open(path, encoding="utf-8-sig", newline="") as f:
    existing = list(csv.DictReader(f))
    cols = list(existing[0].keys()) if existing else list(rows[0].keys())
existing = [r for r in existing if r.get("source_platform") != "1688"]   # rewrite our own 1688 block each run
have = set(r["source_url"] for r in existing)
fresh = [r for r in rows if r["source_url"] not in have]
with io.open(path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(existing)
    w.writerows([{k: r.get(k, "") for k in cols} for r in fresh])
print("added %d live 1688 products (%d already present) -> data/catalog.csv" % (len(fresh), len(rows) - len(fresh)))
